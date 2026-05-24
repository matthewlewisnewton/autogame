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
	verifyToken as serverVerifyToken,
	getJWTSecret
} from '../index.js';
import { clearUsers } from '../users.js';

const require = createRequire(import.meta.url);
const { getSession, getSessionCount } = require('../lobbies.js');

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

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error('startTestServer: timed out')),
			15000
		);

		resetGameState();
		serverIo.removeAllListeners('connection');
		clearAllTimers();
		clearUsers();

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
 * Create a valid JWT token for testing.
 */
function createTestToken(accountId, username = 'testuser') {
	return jwt.sign(
		{ accountId, username },
		getJWTSecret(),
		{ expiresIn: '1h' }
	);
}

/**
 * Connect a client with optional auth and wait for init.
 */
function connectWithAuth(baseUrl, auth = {}) {
	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth
		});

		const timer = setTimeout(() => {
			socket.disconnect();
			reject(new Error('connectWithAuth: timed out waiting for init'));
		}, 10000);

		socket.on('init', (data) => {
			clearTimeout(timer);
			resolve({ socket, init: data });
		});
	});
}

/**
 * Connect a client and wait for connect_error or disconnect (for invalid token tests).
 * When JWT validation runs in io.use() middleware, a rejected connection fires
 * connect_error on the client (not connect → disconnect). We listen for both
 * to remain compatible with either implementation.
 */
function connectExpectDisconnect(baseUrl, auth = {}) {
	return new Promise((resolve, reject) => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth
		});

		const timer = setTimeout(() => {
			socket.disconnect();
			reject(new Error('connectExpectDisconnect: timed out waiting for disconnect or connect_error'));
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

describe('WebSocket JWT Authentication', () => {
	it('accepts a valid JWT and uses accountId as playerId', async () => {
		const testAccountId = 'acct-test-' + Date.now();
		const token = createTestToken(testAccountId, 'testuser');

		const { socket, init } = await connectWithAuth(baseUrl, { token });

		// The init payload should contain the accountId from the token
		expect(init.accountId).toBe(testAccountId);
		// The playerId should be the accountId (authenticated identity)
		expect(init.playerId).toBe(testAccountId);

		// Authenticated players are tracked in session state until they join a lobby
		expect(getSession(testAccountId)).toBeDefined();
		expect(getSession(testAccountId).accountId).toBe(testAccountId);

		socket.disconnect();
	});

	it('disconnects socket on invalid/expired token', async () => {
		const { reason, error } = await connectExpectDisconnect(baseUrl, { token: 'invalid-token-string' });

		// Middleware rejection triggers connect_error, not connect → disconnect
		expect(reason).toBe('connect_error');
		expect(error).toBe('Invalid or expired JWT');

		// No player should have been created
		expect(getSessionCount()).toBe(0);
	});

	it('disconnects socket on malformed JWT', async () => {
		const { reason, error } = await connectExpectDisconnect(baseUrl, { token: 'eyJhbGciOiJIUzI1NiJ9.badsignature' });

		expect(reason).toBe('connect_error');
		expect(error).toBe('Invalid or expired JWT');
		expect(getSessionCount()).toBe(0);
	});

	it('disconnects socket on expired JWT', async () => {
		const expiredToken = jwt.sign(
			{ accountId: 'expired-acct', username: 'expired' },
			'wrong-secret', // wrong secret will also cause disconnect
			{ expiresIn: '-1h' }
		);

		const { reason, error } = await connectExpectDisconnect(baseUrl, { token: expiredToken });

		expect(reason).toBe('connect_error');
		expect(error).toBe('Invalid or expired JWT');
		expect(getSessionCount()).toBe(0);
	});

	it('rejects socket when no token is provided — via connect_error', async () => {
		const { reason, error } = await connectExpectDisconnect(baseUrl, {});

		// Middleware rejection triggers connect_error
		expect(reason).toBe('connect_error');
		expect(error).toBe('No JWT token');

		// No player should have been created
		expect(getSessionCount()).toBe(0);
	});

	it('rejects socket when auth object is empty (no token key) — via connect_error', async () => {
		const { reason, error } = await connectExpectDisconnect(baseUrl, { playerId: 'some-id' });

		expect(reason).toBe('connect_error');
		expect(error).toBe('No JWT token');
		expect(getSessionCount()).toBe(0);
	});

	it('does NOT emit connect event for rejected tokens', async () => {
		// When middleware rejects, the client should receive connect_error
		// but NOT a connect event followed by disconnect.
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth: { token: 'bad-token' }
		});

		let connectFired = false;
		let connectErrorFired = false;

		socket.on('connect', () => { connectFired = true; });
		socket.on('connect_error', () => { connectErrorFired = true; });

		await new Promise(r => setTimeout(r, 1500));
		socket.disconnect();

		expect(connectFired).toBe(false);
		expect(connectErrorFired).toBe(true);
	});

	it('verifies token using server verifyToken helper', () => {
		// Valid token
		const validToken = createTestToken('acct-123', 'user');
		const decoded = serverVerifyToken(validToken);
		expect(decoded).not.toBeNull();
		expect(decoded.accountId).toBe('acct-123');
		expect(decoded.username).toBe('user');

		// Invalid token
		expect(serverVerifyToken('invalid')).toBeNull();
		expect(serverVerifyToken(null)).toBeNull();
		expect(serverVerifyToken(undefined)).toBeNull();
		expect(serverVerifyToken(123)).toBeNull(); // wrong type
	});
});
