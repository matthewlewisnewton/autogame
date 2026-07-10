import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	setTestProvider,
	evictDisconnectedPlayers,
} from '../index.js';
import { InMemoryProvider } from '../providers.js';
import { MAX_PLAYERS, DISCONNECT_GRACE_MS } from '../config.js';
import { ensureTestUserSession } from './helpers.js';

async function startTestServer() {
	for (const [id, conn] of Object.entries(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	if (httpServer.listening) {
		await new Promise((resolve, reject) => {
			const t = setTimeout(() => {
				try { serverIo.close(); } catch (_) {}
				httpServer.close(resolve);
			}, 5000);
			httpServer.close(() => { clearTimeout(t); resolve(); });
		});
	}

	resetGameState();
	serverIo.removeAllListeners('connection');
	clearAllTimers();
	setTestProvider(new InMemoryProvider());

	await startServer(0);
	const addr = httpServer.address();
	return `http://localhost:${addr.port}`;
}

async function closeServer() {
	for (const [id, conn] of Object.entries(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	if (httpServer.listening) {
		await new Promise((resolve) => {
			const t = setTimeout(() => {
				try { serverIo.close(); } catch (_) {}
				httpServer.close(resolve);
			}, 5000);
			httpServer.close(() => { clearTimeout(t); resolve(); });
		});
	}
}

function waitForEvent(socket, event, timeout = 5000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`waitForEvent: timed out waiting for ${event}`)), timeout);
		socket.once(event, (data) => {
			clearTimeout(timer);
			resolve(data);
		});
	});
}

function lobbyGameState(lobbyId) {
	const { getLobbyById } = require('../lobbies.js');
	const lobby = getLobbyById(lobbyId);
	return lobby ? lobby.state : null;
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

class SlowLoadProvider extends InMemoryProvider {
	async loadPlayer(playerId) {
		await sleep(25);
		return super.loadPlayer(playerId);
	}
}

class BlockingLoadProvider extends InMemoryProvider {
	arm() {
		this.blocked = true;
		this.hit = new Promise((resolve) => { this.signalHit = resolve; });
		this.gate = new Promise((resolve) => { this.release = resolve; });
	}

	async loadPlayer(playerId) {
		const value = await super.loadPlayer(playerId);
		if (this.blocked) {
			this.blocked = false;
			this.signalHit();
			await this.gate;
		}
		return value;
	}
}

/** Connect a client and optionally join/create a lobby. */
async function connectClient(baseUrl, accountId, options = {}) {
	const { cookieHeader } = await ensureTestUserSession(String(accountId));

	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			extraHeaders: { cookie: cookieHeader },
		});

		const timer = setTimeout(() => {
			try { socket.disconnect(); } catch (_) {}
			reject(new Error(`connectClient: timed out for ${accountId}`));
		}, 10000);

		socket.on('init', async (data) => {
			clearTimeout(timer);
			socket._playerId = data.playerId || data.id;

			if (options.skipLobby) {
				resolve({ socket, init: data, lobbyId: null });
				return;
			}

			try {
				if (options.joinLobbyId) {
					socket.emit('joinLobby', { lobbyId: options.joinLobbyId });
				} else {
					socket.emit('createLobby', options.name ? { name: options.name } : {});
				}

				// Wait for either lobbyJoined or lobbyError
				const joined = await Promise.race([
					waitForEvent(socket, 'lobbyJoined'),
					waitForEvent(socket, 'lobbyError').then((e) => { throw e; }),
				]);
				socket._lobbyId = joined.lobbyId;
				resolve({ socket, init: joined, lobbyId: joined.lobbyId });
			} catch (err) {
				try { socket.disconnect(); } catch (_) {}
				reject(err);
			}
		});

		socket.on('connect_error', (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

/** Connect and expect a lobbyError (for full-lobby rejection tests). */
async function connectAndTryJoin(baseUrl, accountId, lobbyId) {
	const { cookieHeader } = await ensureTestUserSession(String(accountId));

	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			extraHeaders: { cookie: cookieHeader },
		});

		const timer = setTimeout(() => {
			try { socket.disconnect(); } catch (_) {}
			reject(new Error(`connectAndTryJoin: timed out for ${accountId}`));
		}, 10000);

		socket.on('init', (data) => {
			socket._playerId = data.playerId || data.id;
			clearTimeout(timer);
			socket.emit('joinLobby', { lobbyId });
		});

		socket.once('lobbyError', (result) => {
			resolve({ socket, init: null, result, outcome: 'error' });
		});

		socket.once('lobbyJoined', (result) => {
			resolve({ socket, init: result, result, outcome: 'joined' });
		});

		socket.on('connect_error', (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

// ── Tests ──

describe('MAX_PLAYERS config', () => {
	it('exports MAX_PLAYERS with value 16', () => {
		expect(MAX_PLAYERS).toBe(16);
	});
});

describe('Lobby max-players cap', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('rejects join when lobby already has MAX_PLAYERS players (lobby phase)', async () => {
		// Create lobby and fill it with MAX_PLAYERS players
		const creator = await connectClient(baseUrl, 'max-creator', {});
		const lobbyId = creator.lobbyId;

		// Add MAX_PLAYERS - 1 more players
		const sockets = [creator];
		for (let i = 1; i < MAX_PLAYERS; i++) {
			const p = await connectClient(baseUrl, `max-player-${i}`, { joinLobbyId: lobbyId });
			sockets.push(p);
		}

		const state = lobbyGameState(lobbyId);
		expect(Object.keys(state.players)).toHaveLength(MAX_PLAYERS);

		// The (MAX_PLAYERS + 1)-th player should be rejected
		const rejected = await connectAndTryJoin(baseUrl, 'max-rejected', lobbyId);
		expect(rejected.outcome).toBe('error');
		expect(rejected.result.reason.toLowerCase()).toContain('full');

		// Verify player was NOT added
		const stateAfter = lobbyGameState(lobbyId);
		expect(Object.keys(stateAfter.players)).toHaveLength(MAX_PLAYERS);

		rejected.socket.disconnect();
		for (const s of sockets) s.socket.disconnect();
	});

	it('accepts 16th player when lobby has 15 players', async () => {
		const creator = await connectClient(baseUrl, 'accept-creator', {});
		const lobbyId = creator.lobbyId;

		// Add 14 more players (total 15)
		for (let i = 1; i < 15; i++) {
			const p = await connectClient(baseUrl, `accept-player-${i}`, { joinLobbyId: lobbyId });
			p.socket.disconnect();
		}

		const state = lobbyGameState(lobbyId);
		expect(Object.keys(state.players)).toHaveLength(15);

		// 16th player should succeed
		const sixteenth = await connectClient(baseUrl, 'accept-player-16', { joinLobbyId: lobbyId });
		expect(sixteenth.lobbyId).toBe(lobbyId);

		const stateAfter = lobbyGameState(lobbyId);
		expect(Object.keys(stateAfter.players)).toHaveLength(16);

		sixteenth.socket.disconnect();
	});

	it('serializes concurrent joins so the lobby never exceeds MAX_PLAYERS', async () => {
		const creator = await connectClient(baseUrl, 'race-creator', {});
		const lobbyId = creator.lobbyId;
		const sockets = [creator];
		for (let i = 1; i < 15; i++) {
			sockets.push(await connectClient(baseUrl, `race-player-${i}`, { joinLobbyId: lobbyId }));
		}

		const contenderA = await connectClient(baseUrl, 'race-contender-a', { skipLobby: true });
		const contenderB = await connectClient(baseUrl, 'race-contender-b', { skipLobby: true });
		sockets.push(contenderA, contenderB);
		setTestProvider(new SlowLoadProvider());

		const attemptJoin = (client) => Promise.race([
			waitForEvent(client.socket, 'lobbyJoined').then(() => 'joined'),
			waitForEvent(client.socket, 'lobbyError').then(() => 'error'),
		]);
		const outcomeA = attemptJoin(contenderA);
		const outcomeB = attemptJoin(contenderB);
		contenderA.socket.emit('joinLobby', { lobbyId });
		contenderB.socket.emit('joinLobby', { lobbyId });

		expect((await Promise.all([outcomeA, outcomeB])).sort()).toEqual(['error', 'joined']);
		expect(Object.keys(lobbyGameState(lobbyId).players)).toHaveLength(MAX_PLAYERS);

		for (const client of sockets) client.socket.disconnect();
	});

	it('cancels an in-flight create when the socket disconnects during persistence load', async () => {
		const client = await connectClient(baseUrl, 'disconnect-during-create', { skipLobby: true });
		const provider = new BlockingLoadProvider();
		setTestProvider(provider);
		provider.arm();

		client.socket.emit('createLobby', { name: 'must-not-become-a-ghost' });
		await provider.hit;
		client.socket.disconnect();
		await sleep(50);
		provider.release();
		await sleep(50);

		const { _lobbies } = require('../lobbies.js');
		const memberships = [..._lobbies.values()]
			.filter((lobby) => lobby.state.players[client.init.playerId]);
		const orphan = [..._lobbies.values()]
			.find((lobby) => lobby.name === 'must-not-become-a-ghost');
		expect(memberships).toHaveLength(0);
		expect(orphan).toBeUndefined();
	});

	it('leaveLobby by one of 16 players allows a new joiner', async () => {
		const creator = await connectClient(baseUrl, 'leave-creator', {});
		const lobbyId = creator.lobbyId;
		const sockets = [creator];

		// Fill to MAX_PLAYERS
		for (let i = 1; i < MAX_PLAYERS; i++) {
			const p = await connectClient(baseUrl, `leave-player-${i}`, { joinLobbyId: lobbyId });
			sockets.push(p);
		}

		expect(Object.keys(lobbyGameState(lobbyId).players)).toHaveLength(MAX_PLAYERS);

		// One player leaves
		const leaver = sockets[sockets.length - 1];
		leaver.socket.emit('leaveLobby');
		await waitForEvent(leaver.socket, 'lobbyLeft');

		expect(Object.keys(lobbyGameState(lobbyId).players)).toHaveLength(MAX_PLAYERS - 1);

		// New player should be able to join
		const newPlayer = await connectClient(baseUrl, 'leave-new-player', { joinLobbyId: lobbyId });
		expect(newPlayer.lobbyId).toBe(lobbyId);

		expect(Object.keys(lobbyGameState(lobbyId).players)).toHaveLength(MAX_PLAYERS);

		newPlayer.socket.disconnect();
		leaver.socket.disconnect();
		for (let i = 0; i < sockets.length - 1; i++) sockets[i].socket.disconnect();
	});

	it('disconnect of one of 16 players decrements count allowing new joiner (after grace period)', async () => {
		const creator = await connectClient(baseUrl, 'dc-creator', {});
		const lobbyId = creator.lobbyId;
		const sockets = [creator];

		// Fill to MAX_PLAYERS
		for (let i = 1; i < MAX_PLAYERS; i++) {
			const p = await connectClient(baseUrl, `dc-player-${i}`, { joinLobbyId: lobbyId });
			sockets.push(p);
		}

		expect(Object.keys(lobbyGameState(lobbyId).players)).toHaveLength(MAX_PLAYERS);

		// One player disconnects
		const dcPlayer = sockets[sockets.length - 1];
		dcPlayer.socket.disconnect();
		await sleep(50);

		// The disconnected player is still in the lobby (grace period) — new join should still be rejected
		const prematureJoin = await connectAndTryJoin(baseUrl, 'dc-premature', lobbyId);
		// The disconnected player is still counted (grace period), so join should be rejected
		expect(prematureJoin.outcome).toBe('error');
		prematureJoin.socket.disconnect();

		// Force evict the disconnected player
		const state = lobbyGameState(lobbyId);
		for (const player of Object.values(state.players)) {
			if (player.connected === false) {
				player.disconnectedAt = Date.now() - DISCONNECT_GRACE_MS - 1;
			}
		}
		evictDisconnectedPlayers();

		expect(Object.keys(lobbyGameState(lobbyId).players)).toHaveLength(MAX_PLAYERS - 1);

		// Now a new player should be able to join
		const newPlayer = await connectClient(baseUrl, 'dc-new-player', { joinLobbyId: lobbyId });
		expect(newPlayer.lobbyId).toBe(lobbyId);

		newPlayer.socket.disconnect();
		for (let i = 0; i < sockets.length - 1; i++) sockets[i].socket.disconnect();
	});

	it('rejects drop-in join when playing-phase lobby has MAX_PLAYERS', async () => {
		// Create lobby with 2 players and start a run
		const p1 = await connectClient(baseUrl, 'dropin-host', {});
		const p2 = await connectClient(baseUrl, 'dropin-mate', { joinLobbyId: p1.lobbyId });
		const lobbyId = p1.lobbyId;

		p1.socket.emit('playerReady', true);
		p2.socket.emit('playerReady', true);
		await Promise.all([
			waitForEvent(p1.socket, 'startGame'),
			waitForEvent(p2.socket, 'startGame'),
		]);

		expect(lobbyGameState(lobbyId).gamePhase).toBe('playing');

		// Fill lobby to MAX_PLAYERS by adding more drop-in players
		const sockets = [p1, p2];
		for (let i = 2; i < MAX_PLAYERS; i++) {
			const p = await connectClient(baseUrl, `dropin-fill-${i}`, { joinLobbyId: lobbyId });
			sockets.push(p);
		}

		expect(Object.keys(lobbyGameState(lobbyId).players)).toHaveLength(MAX_PLAYERS);

		// Next drop-in should be rejected
		const rejected = await connectAndTryJoin(baseUrl, 'dropin-rejected', lobbyId);
		expect(rejected.outcome).toBe('error');
		expect(rejected.result.reason.toLowerCase()).toContain('full');

		rejected.socket.disconnect();
		for (const s of sockets) s.socket.disconnect();
	});
});
