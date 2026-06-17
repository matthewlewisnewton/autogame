import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { createRequire } from 'module';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	setTestProvider,
	getJWTSecret,
} from '../index.js';
import { InMemoryProvider } from '../providers.js';

const require = createRequire(import.meta.url);

const serverUsers = require('../users.js');

/**
 * Point the server's CJS `users` module at a test file (same instance as
 * auth.js / index.js). Vitest loads users.js twice (ESM import vs CJS
 * require), so HTTP suites must configure this instance before startServer().
 */
export function setServerUsersFilePath(filePath) {
	serverUsers.setTestFilePath(filePath);
}

export function clearServerUsers() {
	serverUsers.clearUsers();
}

export function createTestToken(accountId, username) {
	return jwt.sign(
		{ accountId, username: username || accountId },
		getJWTSecret(),
		{ expiresIn: '1h' }
	);
}

export function waitForEvent(socket, event, timeout = 10000) {
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

/** Ignore lobby tick snapshots; wait for a playing-run payload. */
export function waitForStateUpdateWithRun(socket, timeout = 10000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error('Timed out waiting for stateUpdate with run')),
			timeout,
		);
		function onStateUpdate(data) {
			if (!data?.run) return;
			clearTimeout(timer);
			socket.off('stateUpdate', onStateUpdate);
			resolve(data);
		}
		socket.on('stateUpdate', onStateUpdate);
	});
}

/** Ignore lobby tick snapshots until player currency meets the threshold. */
export function waitForStateUpdateWithPlayerCurrency(socket, minCurrency, timeout = 10000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Timed out waiting for stateUpdate with currency >= ${minCurrency}`)),
			timeout,
		);
		function onStateUpdate(data) {
			const currency = data?.players?.[socket._playerId]?.currency;
			if (currency == null || currency < minCurrency) return;
			clearTimeout(timer);
			socket.off('stateUpdate', onStateUpdate);
			resolve(data);
		}
		socket.on('stateUpdate', onStateUpdate);
	});
}

export function testGameState() {
	const { getPrimaryLobbyStateForTests } = require('../lobbies.js');
	return getPrimaryLobbyStateForTests();
}

export function lobbyGameState(lobbyId) {
	const { getLobbyById } = require('../lobbies.js');
	const lobby = getLobbyById(lobbyId);
	return lobby ? lobby.state : null;
}

export function lobbyStateForSocket(socket) {
	return lobbyGameState(socket._lobbyId);
}

export function playerForSocket(socket) {
	const state = lobbyStateForSocket(socket);
	return state?.players[socket._playerId];
}

export function getSessionForPlayer(playerId) {
	const { getSession } = require('../lobbies.js');
	return getSession(playerId);
}

export function getSessionCount() {
	const { getSessionCount: countSessions } = require('../lobbies.js');
	return countSessions();
}

/**
 * Tear down the shared server, forcing all sockets closed so the HTTP
 * server's close callback fires immediately instead of waiting on the 5s
 * fallback. `httpServer.close()` only invokes its callback once every open
 * connection has drained; lingering keep-alive/websocket sockets used to keep
 * that pending until the timer expired, costing ~5s per test teardown.
 */
async function teardownServer() {
	// Forcibly disconnect every connected client (closing the underlying
	// transport). Engine.io tracks live connections under `engine.clients`,
	// not `engine.sockets`, so the public Socket.IO API is the reliable way
	// to drop them.
	try { serverIo.disconnectSockets(true); } catch (_) {}
	for (const conn of Object.values(serverIo.engine?.clients || {})) {
		try { conn.close(true); } catch (_) {}
	}
	if (!httpServer.listening) {
		return;
	}
	await new Promise((resolve) => {
		const t = setTimeout(resolve, 5000);
		httpServer.close(() => { clearTimeout(t); resolve(); });
		// Destroy any sockets still held open so close() can complete now.
		if (typeof httpServer.closeAllConnections === 'function') {
			try { httpServer.closeAllConnections(); } catch (_) {}
		}
	});
}

/**
 * Start a fresh server on a random port and return the base URL.
 */
export async function startTestServer() {
	await teardownServer();

	resetGameState();
	serverIo.removeAllListeners('connection');
	clearAllTimers();
	setTestProvider(new InMemoryProvider());
	await startServer(0);
	// Integration suites keep account data on disk via setTestFilePath while
	// player progress uses InMemoryProvider. startServer wires users through
	// the provider; undo that so legacy file-based user tests keep working.
	serverUsers.initUsersWithProvider(null);
	const addr = httpServer.address();
	return `http://localhost:${addr.port}`;
}

export async function closeServer() {
	clearAllTimers();
	await teardownServer();
	resetGameState();
}

/**
 * Connect a test client. By default creates a lobby after session init.
 * Always resolves { socket, init, session, lobbyId }:
 * - init: lobbyJoined payload when a lobby was joined/created, otherwise the session init payload
 * - session: always the session init payload from the server's init event
 * - lobbyId: joined lobby id, or null when skipLobby is set
 */
export function connectClient(baseUrl, accountId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, options = {}) {
	const token = createTestToken(accountId);

	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth: { token },
		});

		const timer = setTimeout(() => {
			try { socket.disconnect(); } catch (_) {}
			reject(new Error(`connectClient: timed out waiting for init from ${baseUrl}`));
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
				try { socket.disconnect(); } catch (_) {}
				reject(err);
			}
		});

		socket.on('connect_error', (e) => {
			clearTimeout(timer);
			reject(e);
		});
	});
}

/**
 * Connect and join a lobby (creates one by default).
 */
export async function connectAndJoinLobby(baseUrl, accountId, options = {}) {
	return connectClient(baseUrl, accountId, options);
}

/**
 * Two authenticated clients in the same lobby (first creates, second joins).
 */
export async function connectTwoClients(baseUrl, accountIdA, accountIdB) {
	const firstId = accountIdA || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const secondId = accountIdB || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const first = await connectClient(baseUrl, firstId);
	const second = await connectClient(baseUrl, secondId, { joinLobbyId: first.lobbyId });
	return {
		socketA: first.socket,
		socketB: second.socket,
		lobbyId: first.lobbyId,
		initA: first.init,
		initB: second.init,
	};
}
