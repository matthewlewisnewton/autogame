import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	setTestProvider,
	getJWTSecret,
	destroySession as serverDestroySession,
} from '../index.js';
import { InMemoryProvider } from '../providers.js';

const require = createRequire(import.meta.url);
const { getSession: getLobbySession, getSessionCount } = require('../lobbies.js');
const { createSession, destroySession } = require('../sessions.js');
const { SESSION_COOKIE_NAME } = require('../cookies.js');
const { createUser, clearUsers } = require('../users.js');

// ── Helpers ──

/**
 * Start a fresh server on a random port and return the base URL.
 */
async function startTestServer() {
	// Disconnect all existing clients
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

	resetGameState();
	serverIo.removeAllListeners('connection');
	clearAllTimers();
	clearUsers();
	setTestProvider(new InMemoryProvider());

	await startServer(0);
	const addr = httpServer.address();
	return `http://localhost:${addr.port}`;
}

/**
 * Close the HTTP server.
 */
async function closeTestServer() {
	if (!httpServer.listening) return;
	for (const [id, conn] of Object.entries(serverIo.engine?.sockets || {})) {
		try { conn.close(true); } catch (_) {}
	}
	await new Promise((resolve) => {
		try { serverIo.close(); } catch (_) {}
		httpServer.close(() => { clearTimeout(resolve); resolve(); });
	});
}

/**
 * Create a test user and return the user record (with accountId).
 */
function createTestUser(username) {
	const result = createUser(username || `testuser-${Date.now()}`, 'password123');
	if (!result.ok) throw new Error(`createUser failed: ${result.reason}`);
	const user = require('../users.js').findUserByUsername(username || `testuser-${Date.now()}`);
	return user;
}

/**
 * Connect a client with a session cookie and wait for init.
 */
function connectWithSessionCookie(baseUrl, sessionToken) {
	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			extraHeaders: {
				cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
			},
		});

		const timer = setTimeout(() => {
			socket.disconnect();
			reject(new Error('connectWithSessionCookie: timed out waiting for init'));
		}, 10000);

		socket.on('init', (data) => {
			clearTimeout(timer);
			resolve({ socket, init: data });
		});

		socket.on('connect_error', (err) => {
			clearTimeout(timer);
			socket.disconnect();
			reject(new Error(`connectWithSessionCookie: connect_error — ${err.message}`));
		});
	});
}

/**
 * Connect a client and wait for connect_error (for rejection tests).
 */
function connectExpectError(baseUrl, options = {}) {
	return new Promise((resolve, reject) => {
		const socketOpts = {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			...options,
		};
		const socket = ClientIO(baseUrl, socketOpts);

		const timer = setTimeout(() => {
			socket.disconnect();
			reject(new Error('connectExpectError: timed out waiting for connect_error'));
		}, 10000);

		socket.on('connect_error', (err) => {
			clearTimeout(timer);
			socket.disconnect();
			resolve({ reason: 'connect_error', error: err.message });
		});

		socket.on('disconnect', (reason) => {
			clearTimeout(timer);
			resolve({ reason });
		});
	});
}

let baseUrl;

beforeEach(async () => {
	baseUrl = await startTestServer();
	clearUsers();
});

afterEach(async () => {
	await closeTestServer();
});

// ── Tests ──

describe('WebSocket session-cookie authentication', () => {
	it('accepts a valid session cookie: connects, init fires, accountId matches', async () => {
		const user = createTestUser('session-user');
		const sessionToken = await createSession(user.accountId);

		const { socket, init } = await connectWithSessionCookie(baseUrl, sessionToken);

		expect(init.accountId).toBe(user.accountId);
		expect(init.playerId).toBe(user.accountId);
		expect(getLobbySession(user.accountId)).toBeDefined();

		socket.disconnect();
	});

	it('rejects connection when no session cookie AND no JWT token', async () => {
		const { reason, error } = await connectExpectError(baseUrl);

		expect(reason).toBe('connect_error');
		expect(error).toBe('No JWT token');
		expect(getSessionCount()).toBe(0);
	});

	it('rejects connection with invalid (unknown) session cookie', async () => {
		const { reason, error } = await connectExpectError(baseUrl, {
			extraHeaders: {
				cookie: `${SESSION_COOKIE_NAME}=totally-fake-token-that-does-not-exist`,
			},
		});

		expect(reason).toBe('connect_error');
		expect(error).toBe('Invalid or expired session');

		// Should NOT fall through to anonymous or JWT
		expect(getSessionCount()).toBe(0);
	});

	it('rejects connection with destroyed session cookie', async () => {
		const user = createTestUser('destroyed-session-user');
		const sessionToken = await createSession(user.accountId);

		// Verify session exists before destroying
		const { socket: sock1 } = await connectWithSessionCookie(baseUrl, sessionToken);
		sock1.disconnect();

		// Destroy the session
		const destroyed = await destroySession(sessionToken);
		expect(destroyed).toBe(true);

		// Reconnecting with the same token should fail
		const { reason, error } = await connectExpectError(baseUrl, {
			extraHeaders: {
				cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
			},
		});

		expect(reason).toBe('connect_error');
		expect(error).toBe('Invalid or expired session');
		expect(getSessionCount()).toBe(0);
	});

	it('accepts valid JWT with no session cookie (JWT fallback preserved)', async () => {
		const token = jwt.sign(
			{ accountId: 'jwt-fallback-user', username: 'jwtuser' },
			getJWTSecret(),
			{ expiresIn: '1h' }
		);

		return new Promise((resolve, reject) => {
			const socket = ClientIO(baseUrl, {
				transports: ['websocket'],
				retry: false,
				autoConnect: true,
				timeout: 5000,
				auth: { token },
			});

			const timer = setTimeout(() => {
				socket.disconnect();
				reject(new Error('JWT fallback: timed out waiting for init'));
			}, 10000);

			socket.on('init', (data) => {
				clearTimeout(timer);
				resolve({ socket, init: data });
			});

			socket.on('connect_error', (err) => {
				clearTimeout(timer);
				socket.disconnect();
				reject(new Error(`JWT fallback: connect_error — ${err.message}`));
			});
		}).then(({ socket, init }) => {
			expect(init.accountId).toBe('jwt-fallback-user');
			expect(init.playerId).toBe('jwt-fallback-user');
			expect(getLobbySession('jwt-fallback-user')).toBeDefined();

			socket.disconnect();
		});
	});

	it('attaches accountId from session to socket.data.accountId and exposes it in init payload', async () => {
		const user = createTestUser('socket-data-user');
		const sessionToken = await createSession(user.accountId);

		const { socket, init } = await connectWithSessionCookie(baseUrl, sessionToken);

		// The init payload carries the accountId from the session
		expect(init.accountId).toBe(user.accountId);

		// The accountId is also stored in the lobby session state
		const lobbySession = getLobbySession(user.accountId);
		expect(lobbySession).toBeDefined();
		expect(lobbySession.accountId).toBe(user.accountId);

		socket.disconnect();
	});
});
