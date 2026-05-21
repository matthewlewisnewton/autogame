import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import {
	startServer,
	resetGameState,
	gameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	verifyToken as serverVerifyToken,
	getJWTSecret
} from '../index.js';
import { clearUsers } from '../users.js';

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
 * Connect a client and wait for disconnect (for invalid token tests).
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
			reject(new Error('connectExpectDisconnect: timed out waiting for disconnect'));
		}, 10000);

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

		// The player should exist in gameState with accountId set
		expect(gameState.players[testAccountId]).toBeDefined();
		expect(gameState.players[testAccountId].accountId).toBe(testAccountId);

		socket.disconnect();
	});

	it('disconnects socket on invalid/expired token', async () => {
		const { reason } = await connectExpectDisconnect(baseUrl, { token: 'invalid-token-string' });

		// Socket.IO disconnect reason for server-initiated disconnect
		expect(reason).toBeDefined();

		// No player should have been created
		const playerCount = Object.keys(gameState.players).length;
		expect(playerCount).toBe(0);
	});

	it('disconnects socket on malformed JWT', async () => {
		const { reason } = await connectExpectDisconnect(baseUrl, { token: 'eyJhbGciOiJIUzI1NiJ9.badsignature' });

		expect(reason).toBeDefined();
		expect(Object.keys(gameState.players).length).toBe(0);
	});

	it('disconnects socket on expired JWT', async () => {
		const expiredToken = jwt.sign(
			{ accountId: 'expired-acct', username: 'expired' },
			'wrong-secret', // wrong secret will also cause disconnect
			{ expiresIn: '-1h' }
		);

		const { reason } = await connectExpectDisconnect(baseUrl, { token: expiredToken });

		expect(reason).toBeDefined();
		expect(Object.keys(gameState.players).length).toBe(0);
	});

	it('disconnects socket when no token is provided', async () => {
		const { reason } = await connectExpectDisconnect(baseUrl, {});

		// Socket.IO disconnect reason for server-initiated disconnect
		expect(reason).toBeDefined();

		// No player should have been created
		expect(Object.keys(gameState.players).length).toBe(0);
	});

	it('disconnects socket when auth object is empty (no token key)', async () => {
		const { reason } = await connectExpectDisconnect(baseUrl, { playerId: 'some-id' });

		expect(reason).toBeDefined();
		expect(Object.keys(gameState.players).length).toBe(0);
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
