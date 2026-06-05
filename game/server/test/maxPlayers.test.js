import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	getJWTSecret,
	evictDisconnectedPlayers,
	DISCONNECT_GRACE_MS,
	setTestProvider,
} from '../index.js';
import { InMemoryProvider } from '../providers.js';

// ── Helpers ──

function createTestToken(accountId, username) {
	return jwt.sign(
		{ accountId, username: username || accountId },
		getJWTSecret(),
		{ expiresIn: '1h' }
	);
}

async function startTestServer() {
	for (const conn of Object.values(serverIo.engine?.sockets || {})) {
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

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error('startTestServer: timed out')),
			15000
		);

		resetGameState();
		require('../lobbies.js').resetAllLobbies();
		serverIo.removeAllListeners('connection');
		clearAllTimers();
		setTestProvider(new InMemoryProvider());

		startServer(0);

		httpServer.once('listening', () => {
			clearTimeout(timeout);
			const addr = httpServer.address();
			resolve(`http://localhost:${addr.port}`);
		});

		httpServer.once('error', (e) => {
			clearTimeout(timeout);
			reject(e);
		});
	});
}

async function closeTestServer() {
	if (!httpServer.listening) return;
	for (const conn of Object.values(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	await new Promise((resolve) => {
		try { serverIo.close(); } catch (_) {}
		httpServer.close(() => resolve());
	});
}

function waitForEvent(socket, event, timeout = 3000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Timed out waiting for "${event}"`)),
			timeout
		);
		socket.once(event, (data) => {
			clearTimeout(timer);
			resolve(data);
		});
	});
}

/**
 * Connect a client socket and create a lobby.
 * Returns { socket, lobbyId, playerId }.
 */
async function createLobby(baseUrl, accountId) {
	const token = createTestToken(accountId);

	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth: { token }
		});

		const timer = setTimeout(() => {
			try { socket.disconnect(); } catch (_) {}
			reject(new Error(`createLobby: timed out for ${accountId}`));
		}, 10000);

		socket.on('init', (data) => {
			const playerId = data.playerId || data.id;
			socket.emit('createLobby', {});
		});

		socket.on('lobbyJoined', (data) => {
			clearTimeout(timer);
			resolve({ socket, lobbyId: data.lobbyId, playerId: data.playerId || data.id });
		});

		socket.on('connect_error', (e) => {
			clearTimeout(timer);
			reject(e);
		});
	});
}

/**
 * Connect a client socket and join an existing lobby.
 * Returns { socket, lobbyId, playerId }.
 */
async function joinLobby(baseUrl, accountId, lobbyId) {
	const token = createTestToken(accountId);

	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth: { token }
		});

		const timer = setTimeout(() => {
			try { socket.disconnect(); } catch (_) {}
			reject(new Error(`joinLobby: timed out for ${accountId}`));
		}, 10000);

		socket.on('init', (data) => {
			const playerId = data.playerId || data.id;
			socket.emit('joinLobby', { lobbyId });
		});

		socket.on('lobbyJoined', (data) => {
			clearTimeout(timer);
			resolve({ socket, lobbyId: data.lobbyId, playerId: data.playerId || data.id, rejected: false });
		});

		socket.on('lobbyError', (data) => {
			clearTimeout(timer);
			resolve({ socket, lobbyId: null, playerId: null, rejected: true, error: data });
		});

		socket.on('connect_error', (e) => {
			clearTimeout(timer);
			reject(e);
		});
	});
}

/**
 * Connect N players to the same lobby. Returns array of { socket, lobbyId, playerId }.
 */
async function connectPlayers(baseUrl, count, lobbyId) {
	const players = [];
	for (let i = 0; i < count; i++) {
		const accountId = `p${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		const result = await joinLobby(baseUrl, accountId, lobbyId);
		players.push(result);
	}
	return players;
}

// ── Tests ──

describe('MAX_LOBBY_PLAYERS cap enforcement', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeTestServer();
		require('../lobbies.js').resetAllLobbies();
	});

	it('MAX_LOBBY_PLAYERS constant equals 16', () => {
		expect(config.MAX_LOBBY_PLAYERS).toBe(16);
	});

	it('joinLobby is rejected with lobbyError when a lobby has 16 connected players', async () => {
		// Create lobby with first player
		const creator = await createLobby(baseUrl, 'cap-creator');
		expect(creator.lobbyId).toBeTruthy();

		// Add 15 more players to reach 16 total
		const others = await connectPlayers(baseUrl, 15, creator.lobbyId);
		for (const p of others) {
			expect(p.rejected).toBe(false);
		}

		// Verify lobby has 16 players
		const { listLobbySummaries } = require('../lobbies.js');
		const summaries = listLobbySummaries();
		const summary = summaries.find((s) => s.id === creator.lobbyId);
		expect(summary.playerCount).toBe(16);

		// 17th player should be rejected
		const rejected = await joinLobby(baseUrl, 'cap-rejected', creator.lobbyId);
		expect(rejected.rejected).toBe(true);
		expect(rejected.error.reason).toBe('Lobby is full');
	});

	it('leaveLobby decrements count and allows a new player to join the freed slot', async () => {
		// Create lobby and fill to 16 players
		const creator = await createLobby(baseUrl, 'leave-creator');
		const others = await connectPlayers(baseUrl, 15, creator.lobbyId);

		// Verify 17th player is rejected
		const rejected = await joinLobby(baseUrl, 'leave-rejected', creator.lobbyId);
		expect(rejected.rejected).toBe(true);

		// Have one player leave explicitly
		const leaver = others[0];
		leaver.socket.emit('leaveLobby');

		// Wait for state to settle
		await new Promise((r) => setTimeout(r, 300));

		// Verify lobby now has 15 players
		const { listLobbySummaries: listLobbySummariesAfter } = require('../lobbies.js');
		const summariesAfter = listLobbySummariesAfter();
		const summaryAfter = summariesAfter.find((s) => s.id === creator.lobbyId);
		expect(summaryAfter.playerCount).toBe(15);

		// New player should now be able to join
		const rejoined = await joinLobby(baseUrl, 'leave-rejoined', creator.lobbyId);
		expect(rejoined.rejected).toBe(false);
		expect(rejoined.lobbyId).toBe(creator.lobbyId);
	});

	it('disconnected ghost player does not count toward cap — new player can join with 16 connected + 1 ghost', async () => {
		// Create lobby and fill to 16 players
		const creator = await createLobby(baseUrl, 'ghost-creator');
		const others = await connectPlayers(baseUrl, 15, creator.lobbyId);

		// Disconnect one player (simulate socket disconnect → ghost)
		others[0].socket.disconnect();

		// Wait for disconnect to process
		await new Promise((r) => setTimeout(r, 300));

		// New player should be able to join because ghost doesn't count toward cap
		const newPlayer = await joinLobby(baseUrl, 'ghost-new', creator.lobbyId);
		expect(newPlayer.rejected).toBe(false);
		expect(newPlayer.lobbyId).toBe(creator.lobbyId);
	});

	it('lobbySummary playerCount correctly reflects remaining players after evictDisconnectedPlayers', async () => {
		// Create lobby and fill to 16 players
		const creator = await createLobby(baseUrl, 'evict-creator');
		const others = await connectPlayers(baseUrl, 15, creator.lobbyId);

		// Verify initial player count is 16
		const { listLobbySummaries: listLobbySummariesBefore } = require('../lobbies.js');
		const summariesBefore = listLobbySummariesBefore();
		const summaryBefore = summariesBefore.find((s) => s.id === creator.lobbyId);
		expect(summaryBefore.playerCount).toBe(16);

		// Disconnect one player to create a ghost
		others[0].socket.disconnect();

		// Wait for disconnect to process
		await new Promise((r) => setTimeout(r, 200));

		// Player count should still be 16 (ghost still in lobby state)
		const summariesAfterDisconnect = listLobbySummariesBefore();
		const summaryAfterDisconnect = summariesAfterDisconnect.find((s) => s.id === creator.lobbyId);
		expect(summaryAfterDisconnect.playerCount).toBe(16);

		// Fast-forward the ghost's disconnectedAt to exceed grace period
		const { getLobbyById: getLobby } = require('../lobbies.js');
		const lobby = getLobby(creator.lobbyId);
		for (const [, player] of Object.entries(lobby.state.players)) {
			if (player.connected === false) {
				player.disconnectedAt = Date.now() - DISCONNECT_GRACE_MS - 1;
			}
		}

		// Run eviction
		evictDisconnectedPlayers();

		// Wait for state to settle
		await new Promise((r) => setTimeout(r, 200));

		// Player count should now be 15 (ghost evicted)
		const summariesAfterEvict = listLobbySummariesBefore();
		const summaryAfterEvict = summariesAfterEvict.find((s) => s.id === creator.lobbyId);
		expect(summaryAfterEvict.playerCount).toBe(15);
	});
});
