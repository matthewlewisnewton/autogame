import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { initAuth, resetAuthSecret } from '../auth.js';
import { clearUsers, setTestFilePath } from '../users.js';
import { clearAllSettings, resetSettingsPath } from '../settings.js';
import {
	startTestServer,
	closeServer,
	createTestToken,
	waitForEvent,
	lobbyGameState,
} from './helpers.js';

const customCosmetic = {
	bodyColor: '#112233',
	accentColor: '#445566',
	bodyShape: 'cone',
	hat: 'none',
	modelId: 'player',
	proportions: {
		height: 1.1,
		headSize: 0.9,
		torsoWidth: 1.0,
		armLength: 1.0,
		legLength: 1.0,
		shoulderWidth: 1.0,
	},
};

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForHubPresenceWithPlayer(socket, playerId, timeout = 10000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Timed out waiting for hubPresenceUpdate with ${playerId}`)),
			timeout,
		);
		const onUpdate = (data) => {
			if (!data?.players?.[playerId]) return;
			clearTimeout(timer);
			socket.off('hubPresenceUpdate', onUpdate);
			resolve(data);
		};
		socket.on('hubPresenceUpdate', onUpdate);
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
	const { token } = await login.json();
	return { accountId, token };
}

async function patchCosmetic(baseUrl, token, cosmetic) {
	const res = await fetch(`${baseUrl}/api/me/profile`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ cosmetic }),
	});
	expect(res.status).toBe(200);
	return res.json();
}

function connectWithUsername(baseUrl, accountId, username, options = {}) {
	const token = createTestToken(accountId, username);

	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth: { token },
		});

		const timer = setTimeout(() => {
			try { socket.disconnect(); } catch {}
			reject(new Error('connectWithUsername: timed out waiting for init'));
		}, 10000);

		socket.on('init', async (data) => {
			clearTimeout(timer);
			socket._playerId = data.playerId || data.id;

			if (options.skipLobby) {
				resolve({ socket, init: data, session: data, lobbyId: null });
				return;
			}

			try {
				if (options.joinLobbyId) {
					socket.emit('joinLobby', { lobbyId: options.joinLobbyId });
				} else {
					socket.emit('createLobby', options.name ? { name: options.name } : {});
				}
				const joined = await waitForEvent(socket, 'lobbyJoined');
				socket._lobbyId = joined.lobbyId;
				resolve({ socket, init: joined, session: data, lobbyId: joined.lobbyId });
			} catch (err) {
				try { socket.disconnect(); } catch {}
				reject(err);
			}
		});

		socket.on('connect_error', reject);
	});
}

async function connectTwoInLobby(baseUrl, accountIdA, usernameA, accountIdB, usernameB) {
	const first = await connectWithUsername(baseUrl, accountIdA, usernameA, { name: 'Hub Presence Room' });
	const second = await connectWithUsername(baseUrl, accountIdB, usernameB, { joinLobbyId: first.lobbyId });
	return {
		socketA: first.socket,
		socketB: second.socket,
		lobbyId: first.lobbyId,
		accountA: accountIdA,
		accountB: accountIdB,
	};
}

describe('hub presence broadcast lifecycle (integration)', () => {
	let baseUrl;
	let tmpUserFile;
	let tmpDataDir;

	beforeEach(async () => {
		tmpUserFile = path.join(
			os.tmpdir(),
			`hub-presence-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-presence-data-'));
		process.env.PERSISTENCE_PATH = tmpDataDir;
		setTestFilePath(tmpUserFile);
		clearUsers();
		resetSettingsPath();
		clearAllSettings();
		resetAuthSecret();
		initAuth();
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
		delete process.env.PERSISTENCE_PATH;
		try { fs.unlinkSync(tmpUserFile); } catch {}
		try { fs.rmSync(tmpDataDir, { recursive: true, force: true }); } catch {}
	});

	it('second join adds peer with cosmetic to presence payload received by first client', async () => {
		const { accountId: accountA } = await registerUser(baseUrl, 'presence_a');
		const { accountId: accountB, token: tokenB } = await registerUser(baseUrl, 'presence_b');
		await patchCosmetic(baseUrl, tokenB, customCosmetic);

		const host = await connectWithUsername(baseUrl, accountA, 'presence_a', { name: 'Presence Host' });
		const presencePromise = waitForHubPresenceWithPlayer(host.socket, accountB);

		await connectWithUsername(baseUrl, accountB, 'presence_b', { joinLobbyId: host.lobbyId });

		const update = await presencePromise;
		expect(update.lobbyId).toBe(host.lobbyId);
		expect(update.players[accountB]).toBeDefined();
		expect(update.players[accountB].cosmetic).toEqual(customCosmetic);
		expect(update.players[accountB].username).toBe('presence_b');

		host.socket.disconnect();
	});

	it('move updates peer x/z in hubPresenceUpdate after a tick', async () => {
		const { accountId: accountA } = await registerUser(baseUrl, 'move_a');
		const { accountId: accountB } = await registerUser(baseUrl, 'move_b');

		const { socketA, socketB, accountB: peerId } = await connectTwoInLobby(
			baseUrl, accountA, 'move_a', accountB, 'move_b',
		);

		const initial = await waitForEvent(socketA, 'hubPresenceUpdate');
		const startX = initial.players[peerId].x;
		const startZ = initial.players[peerId].z;

		const movedPromise = waitForEvent(socketA, 'hubPresenceUpdate');
		socketB.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
		const moved = await movedPromise;

		expect(moved.players[peerId].x).toBeGreaterThan(startX);
		expect(moved.players[peerId].z).toBeCloseTo(startZ, 5);

		socketA.disconnect();
		socketB.disconnect();
	});

	it('leaver disappears from peer next hubPresenceUpdate', async () => {
		const { accountId: accountA } = await registerUser(baseUrl, 'leave_a');
		const { accountId: accountB } = await registerUser(baseUrl, 'leave_b');

		const { socketA, socketB, accountB: peerId } = await connectTwoInLobby(
			baseUrl, accountA, 'move_a', accountB, 'move_b',
		);
		await waitForEvent(socketA, 'hubPresenceUpdate');

		const afterLeavePromise = waitForEvent(socketA, 'hubPresenceUpdate');
		socketB.emit('leaveLobby');
		const afterLeave = await afterLeavePromise;

		expect(afterLeave.players[peerId]).toBeUndefined();
		expect(afterLeave.players[accountA]).toBeDefined();

		socketA.disconnect();
	});

	it('stops hubPresenceUpdate during playing phase while stateUpdate continues', async () => {
		const { accountId: accountA } = await registerUser(baseUrl, 'play_a');
		const { accountId: accountB } = await registerUser(baseUrl, 'play_b');

		const { socketA, socketB } = await connectTwoInLobby(
			baseUrl, accountA, 'play_a', accountB, 'play_b',
		);
		await waitForEvent(socketA, 'hubPresenceUpdate');

		let hubPresenceDuringPlay = false;
		socketA.on('hubPresenceUpdate', () => {
			hubPresenceDuringPlay = true;
		});

		const startA = waitForEvent(socketA, 'startGame');
		const startB = waitForEvent(socketB, 'startGame');
		socketA.emit('playerReady', true);
		socketB.emit('playerReady', true);
		await Promise.all([startA, startB]);

		const stateUpdatePromise = waitForEvent(socketA, 'stateUpdate');
		socketB.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
		await stateUpdatePromise;
		await sleep(120);

		expect(hubPresenceDuringPlay).toBe(false);

		socketA.disconnect();
		socketB.disconnect();
	});

	it('mid-run leave does not ghost in hub presence after return to lobby', async () => {
		const { accountId: accountA } = await registerUser(baseUrl, 'midrun_a');
		const { accountId: accountB } = await registerUser(baseUrl, 'midrun_b');

		const { socketA, socketB, lobbyId, accountB: leaverId } = await connectTwoInLobby(
			baseUrl, accountA, 'midrun_a', accountB, 'midrun_b',
		);
		await waitForHubPresenceWithPlayer(socketA, leaverId);

		const startA = waitForEvent(socketA, 'startGame');
		const startB = waitForEvent(socketB, 'startGame');
		socketA.emit('playerReady', true);
		socketB.emit('playerReady', true);
		await Promise.all([startA, startB]);
		await waitForEvent(socketA, 'stateUpdate');

		socketB.emit('leaveLobby');
		await waitForEvent(socketA, 'playerDisconnected');

		const state = lobbyGameState(lobbyId);
		expect(state.gamePhase).toBe('playing');
		state.run.status = 'victory';

		const returnPromise = waitForEvent(socketA, 'stateUpdate');
		const presenceAfterReturnPromise = waitForEvent(socketA, 'hubPresenceUpdate');
		socketA.emit('returnToLobby');
		await returnPromise;
		const afterReturn = await presenceAfterReturnPromise;

		expect(lobbyGameState(lobbyId).gamePhase).toBe('lobby');
		expect(afterReturn.players[leaverId]).toBeUndefined();
		expect(afterReturn.players[accountA]).toBeDefined();

		socketA.disconnect();
	});
});
