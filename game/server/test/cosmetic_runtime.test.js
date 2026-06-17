import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
	startServer,
	resetGameState,
	gameState,
	buildPlayerRecord,
	stateSnapshot,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
} from '../index.js';
import {
	connectAndJoinLobby,
	setServerUsersFilePath,
	clearServerUsers,
	waitForEvent,
	extractSessionTokenFromResponse,
	cookieHeaders,
} from './helpers.js';
import { APPEARANCE_CHANGE_COST } from '../config.js';

const require = createRequire(import.meta.url);
import { DEFAULT_COSMETIC, PROPORTION_KEYS } from '../cosmetic.js';
import { clearAllSettings, resetSettingsPath } from '../settings.js';

const customCosmetic = {
	bodyColor: '#112233',
	accentColor: '#445566',
	bodyShape: 'cone',
	hat: 'none',
	modelId: 'player',
	proportions: { height: 1.1, headSize: 0.9, torsoWidth: 1.0, armLength: 1.0, legLength: 1.0, shoulderWidth: 1.0 }
};

async function startTestServer() {
	if (httpServer.listening) {
		await new Promise((resolve) => {
			try { serverIo.close(); } catch (_) {}
			httpServer.close(() => resolve());
		});
	}
	resetGameState();
	serverIo.removeAllListeners('connection');
	clearAllTimers();
	clearServerUsers();
	await startServer(0);
	return `http://localhost:${httpServer.address().port}`;
}

async function closeTestServer() {
	if (!httpServer.listening) return;
	await new Promise((resolve) => {
		try { serverIo.close(); } catch (_) {}
		httpServer.close(() => resolve());
	});
}

/** Register + login a user, returning { accountId, sessionToken }. */
async function registerUser(baseUrl, username, password = 'password123') {
	const reg = await fetch(`${baseUrl}/api/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	expect(reg.status).toBe(201);
	const { accountId } = await reg.json();
	const login = await fetch(`${baseUrl}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	expect(login.status).toBe(200);
	const sessionToken = extractSessionTokenFromResponse(login);
	expect(sessionToken).toBeTruthy();
	return { accountId, sessionToken };
}

async function patchCosmetic(baseUrl, sessionToken, cosmetic) {
	const res = await fetch(`${baseUrl}/api/me/profile`, {
		method: 'PATCH',
		headers: cookieHeaders(sessionToken),
		body: JSON.stringify({ cosmetic }),
	});
	expect(res.status).toBe(200);
	return res.json();
}

describe('cosmetic in runtime state & stateUpdate snapshot', () => {
	let baseUrl;
	let tmpUserFile;
	let tmpDataDir;

	beforeEach(async () => {
		tmpUserFile = path.join(os.tmpdir(), `cosmetic-runtime-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
		tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmetic-runtime-data-'));
		process.env.PERSISTENCE_PATH = tmpDataDir;
		setServerUsersFilePath(tmpUserFile);
		clearServerUsers();
		resetSettingsPath();
		clearAllSettings();
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeTestServer();
		delete process.env.PERSISTENCE_PATH;
		try { fs.unlinkSync(tmpUserFile); } catch {}
		try { fs.rmSync(tmpDataDir, { recursive: true, force: true }); } catch {}
	});

	it('buildPlayerRecord sources the cosmetic from the account record', async () => {
		const { accountId, sessionToken } = await registerUser(baseUrl, 'alice');
		await patchCosmetic(baseUrl, sessionToken, customCosmetic);

		const player = buildPlayerRecord('p1', accountId, 'alice', null);
		expect(player.cosmetic).toEqual(customCosmetic);
	});

	it('buildPlayerRecord falls back to a copy of the default cosmetic when no account is found', () => {
		const player = buildPlayerRecord('p2', 'no-such-account', 'ghost', null);
		expect(player.cosmetic).toEqual(DEFAULT_COSMETIC);
		// a copy, not a shared reference to the module constant
		expect(player.cosmetic).not.toBe(DEFAULT_COSMETIC);
	});

	it('stateSnapshot exposes each player cosmetic with the full body/accent/shape', async () => {
		const { accountId, sessionToken } = await registerUser(baseUrl, 'bob');
		await patchCosmetic(baseUrl, sessionToken, customCosmetic);

		gameState.players['p3'] = buildPlayerRecord('p3', accountId, 'bob', null);
		const snapshot = stateSnapshot();
		expect(snapshot.players['p3'].cosmetic).toEqual(customCosmetic);
		expect(Object.keys(snapshot.players['p3'].cosmetic).sort()).toEqual(
			['accentColor', 'bodyColor', 'bodyShape', 'hat', 'modelId', 'proportions']
		);
	});

	it('stateSnapshot defaults the cosmetic for a player record lacking one', () => {
		const player = buildPlayerRecord('p4', 'no-such-account', 'anon', null);
		delete player.cosmetic;
		gameState.players['p4'] = player;
		const snapshot = stateSnapshot();
		expect(snapshot.players['p4'].cosmetic).toEqual(DEFAULT_COSMETIC);
	});

	it('snapshot reflects an account cosmetic updated before the player joins', async () => {
		const { accountId, sessionToken } = await registerUser(baseUrl, 'carol');
		// account starts with defaults; update it, then the player joins
		await patchCosmetic(baseUrl, sessionToken, { bodyShape: 'capsule', bodyColor: '#00ff00' });

		gameState.players['p5'] = buildPlayerRecord('p5', accountId, 'carol', null);
		const snapshot = stateSnapshot();
		expect(snapshot.players['p5'].cosmetic.bodyShape).toBe('capsule');
		expect(snapshot.players['p5'].cosmetic.bodyColor).toBe('#00ff00');
		expect(snapshot.players['p5'].cosmetic.accentColor).toBe(DEFAULT_COSMETIC.accentColor);
	});

	it('PATCH profile cosmetic syncs an existing live player record and snapshot', async () => {
		const { gameState: liveState, setGameState, stateSnapshot, buildPlayerRecord: buildPlayer } = require('../index.js');
		const { PHASES } = require('../lobbies.js');
		const { accountId, sessionToken } = await registerUser(baseUrl, 'dave');
		liveState.players[accountId] = buildPlayer(accountId, accountId, 'dave', null);
		// PATCH appearance fields are blocked only for live lobby-hub players.
		liveState.gamePhase = PHASES.PLAYING;
		expect(liveState.players[accountId].cosmetic.bodyColor).toBe(DEFAULT_COSMETIC.bodyColor);

		await patchCosmetic(baseUrl, sessionToken, customCosmetic);

		expect(liveState.players[accountId].cosmetic.bodyColor).toBe(customCosmetic.bodyColor);
		expect(liveState.players[accountId].cosmetic.hat).toBe(customCosmetic.hat);
		expect(liveState.players[accountId].cosmetic.proportions.height).toBe(customCosmetic.proportions.height);

		setGameState(liveState);
		const snapshot = stateSnapshot();
		expect(snapshot.players[accountId].cosmetic).toEqual(customCosmetic);
	});

	it('applyAppearanceChange syncs a joined lobby player for the next snapshot', async () => {
		const { setGameState, stateSnapshot } = require('../index.js');
		const { getLobbyById } = require('../lobbies.js');
		const { accountId } = await registerUser(baseUrl, 'erin');
		const { socket, lobbyId } = await connectAndJoinLobby(baseUrl, accountId);

		const lobby = getLobbyById(lobbyId);
		expect(lobby).not.toBeNull();
		expect(lobby.state.players[accountId].cosmetic.bodyColor).toBe(DEFAULT_COSMETIC.bodyColor);

		lobby.state.players[accountId].currency = APPEARANCE_CHANGE_COST + 50;
		const changedPromise = waitForEvent(socket, 'appearanceChanged');
		socket.emit('applyAppearanceChange', { cosmetic: customCosmetic });
		await changedPromise;

		expect(lobby.state.players[accountId].cosmetic.bodyColor).toBe(customCosmetic.bodyColor);
		expect(lobby.state.players[accountId].cosmetic.hat).toBe(customCosmetic.hat);
		expect(lobby.state.players[accountId].cosmetic.proportions.height).toBe(customCosmetic.proportions.height);

		setGameState(lobby.state);
		const snapshot = stateSnapshot();
		expect(snapshot.players[accountId].cosmetic).toEqual(customCosmetic);

		socket.disconnect();
	});
});
