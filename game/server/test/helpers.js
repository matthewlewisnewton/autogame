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
 * Start a fresh server on a random port and return the base URL.
 */
export async function startTestServer() {
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
		const timeout = setTimeout(() => reject(new Error('startTestServer timed out')), 15000);
		resetGameState();
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

export async function closeServer() {
	for (const conn of Object.values(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	await new Promise((resolve) => {
		const t = setTimeout(() => {
			try { serverIo.close(); } catch (_) {}
			resolve();
		}, 5000);
		httpServer.close(() => { clearTimeout(t); resolve(); });
	});
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
