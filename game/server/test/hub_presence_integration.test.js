import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { HUB_LAYOUT } from '../index.js';
import { hubSpawnPosition } from '../simulation.js';
import { resetSettingsPath, clearAllSettings } from '../settings.js';
import {
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
	setServerUsersFilePath,
	clearServerUsers,
	connectWithSessionCookie,
	extractSessionTokenFromResponse,
	cookieHeaders,
} from './helpers.js';

const COSMETIC_A = {
	bodyColor: '#112233',
	accentColor: '#445566',
	bodyShape: 'cone',
	hat: 'none',
};

const COSMETIC_B = {
	bodyColor: '#ff00aa',
	accentColor: '#33cc33',
	bodyShape: 'cylinder',
	hat: 'bandana',
};

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForHubPresenceRemoval(socket, playerId, timeout = 10000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Timed out waiting for removal of ${playerId}`)),
			timeout,
		);
		const handler = (update) => {
			if (update.removedPlayerIds?.includes(playerId)) {
				clearTimeout(timer);
				socket.off('hubPresenceUpdate', handler);
				resolve(update);
			}
		};
		socket.on('hubPresenceUpdate', handler);
	});
}

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
	return { accountId, sessionToken, username };
}

async function connectWithSession(baseUrl, sessionToken, options = {}) {
	return connectWithSessionCookie(baseUrl, sessionToken, options);
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

async function connectTwoWithCosmetics(baseUrl, userA, userB) {
	const first = await connectWithSession(baseUrl, userA.sessionToken);
	const second = await connectWithSession(baseUrl, userB.sessionToken, { joinLobbyId: first.lobbyId });
	return {
		socketA: first.socket,
		socketB: second.socket,
		lobbyId: first.lobbyId,
		initA: first.init,
		initB: second.init,
		userA,
		userB,
	};
}

describe('hub presence integration', () => {
	let baseUrl;
	let tmpUserFile;
	let tmpDataDir;

	beforeEach(async () => {
		tmpUserFile = path.join(
			os.tmpdir(),
			`hub-presence-int-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-presence-int-data-'));
		process.env.PERSISTENCE_PATH = tmpDataDir;
		setServerUsersFilePath(tmpUserFile);
		clearServerUsers();
		resetSettingsPath();
		clearAllSettings();
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
		delete process.env.PERSISTENCE_PATH;
		try { fs.unlinkSync(tmpUserFile); } catch (_) {}
		try { fs.rmSync(tmpDataDir, { recursive: true, force: true }); } catch (_) {}
	});

	it('move updates merged lobby player record and broadcasts distinct cosmetics', async () => {
		const hubSpawn = hubSpawnPosition(HUB_LAYOUT);
		const userA = await registerUser(baseUrl, 'presence-move-a');
		await patchCosmetic(baseUrl, userA.sessionToken, COSMETIC_A);
		const userB = await registerUser(baseUrl, 'presence-move-b');
		await patchCosmetic(baseUrl, userB.sessionToken, COSMETIC_B);

		const { socketA, socketB, lobbyId, initA, initB } = await connectTwoWithCosmetics(
			baseUrl,
			userA,
			userB,
		);

		const state = lobbyGameState(lobbyId);
		expect(state.gamePhase).toBe('lobby');
		expect(state.players[initA.playerId].cosmetic.bodyShape).toBe('cone');
		expect(state.players[initB.playerId].cosmetic.hat).toBe('bandana');

		const updatePromise = waitForEvent(socketB, 'hubPresenceUpdate');
		socketA.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
		await sleep(150);

		const update = await updatePromise;
		const entryA = update.presence.entries[initA.playerId];
		expect(entryA).toBeDefined();
		expect(entryA.cosmetic.bodyShape).toBe('cone');
		expect(entryA.x).toBeGreaterThan(hubSpawn.x + 0.05);
		expect(entryA.z).toBeCloseTo(hubSpawn.z, 1);

		const mergedA = state.players[initA.playerId];
		expect(mergedA.x).toBeGreaterThan(hubSpawn.x + 0.05);
		expect(mergedA.z).toBeCloseTo(hubSpawn.z, 1);
		expect(mergedA.cosmetic.bodyColor).toBe('#112233');
	});

	it('late join notifies existing member with cosmetic and username', async () => {
		const userA = await registerUser(baseUrl, 'presence-host');
		await patchCosmetic(baseUrl, userA.sessionToken, COSMETIC_A);
		const userB = await registerUser(baseUrl, 'presence-joiner');
		await patchCosmetic(baseUrl, userB.sessionToken, COSMETIC_B);

		const host = await connectWithSession(baseUrl, userA.sessionToken);
		const joinUpdatePromise = waitForEvent(host.socket, 'hubPresenceUpdate');
		const joiner = await connectWithSession(baseUrl, userB.sessionToken, { joinLobbyId: host.lobbyId });

		const update = await joinUpdatePromise;
		const joinerEntry = update.presence.entries[joiner.init.playerId];
		expect(joinerEntry).toBeDefined();
		expect(joinerEntry.username).toBe('presence-joiner');
		expect(joinerEntry.cosmetic.bodyShape).toBe('cylinder');
		expect(joinerEntry.cosmetic.hat).toBe('bandana');
		expect(joinerEntry.cosmetic.bodyColor).toBe('#ff00aa');
	});

	it('leaveLobby removes departed player from presence snapshot', async () => {
		const userA = await registerUser(baseUrl, 'presence-stay');
		await patchCosmetic(baseUrl, userA.sessionToken, COSMETIC_A);
		const userB = await registerUser(baseUrl, 'presence-leave');
		await patchCosmetic(baseUrl, userB.sessionToken, COSMETIC_B);

		const { socketA, socketB, initA, initB } = await connectTwoWithCosmetics(
			baseUrl,
			userA,
			userB,
		);

		const leaveUpdatePromise = waitForHubPresenceRemoval(socketA, initB.playerId);
		socketB.emit('leaveLobby');
		const update = await leaveUpdatePromise;

		expect(update.removedPlayerIds).toEqual([initB.playerId]);
		expect(update.presence.entries[initB.playerId]).toBeUndefined();
		expect(update.presence.entries[initA.playerId]).toBeDefined();
	});
});
