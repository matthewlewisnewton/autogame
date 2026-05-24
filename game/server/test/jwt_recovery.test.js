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
 * Connect a client and wait for connect_error.
 * Resolves with the error message; rejects on timeout.
 */
function connectExpectError(baseUrl, auth = {}) {
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
			reject(new Error('connectExpectError: timed out waiting for connect_error'));
		}, 10000);

		socket.on('connect_error', (err) => {
			clearTimeout(timer);
			socket.disconnect();
			resolve({ error: err.message });
		});
	});
}

/**
 * Connect a client and wait for init (happy path).
 */
function connectExpectInit(baseUrl, auth = {}) {
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
			reject(new Error('connectExpectInit: timed out waiting for init'));
		}, 10000);

		socket.on('init', (data) => {
			clearTimeout(timer);
			resolve({ socket, init: data });
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

describe('JWT Recovery Integration', () => {
	it('invalid token triggers connect_error (not connect)', async () => {
		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			retry: false,
			autoConnect: true,
			timeout: 5000,
			auth: { token: 'invalid-token' }
		});

		let connectFired = false;
		let connectErrorFired = false;
		let errorMessage = null;

		socket.on('connect', () => { connectFired = true; });
		socket.on('connect_error', (err) => {
			connectErrorFired = true;
			errorMessage = err.message;
		});

		await new Promise(r => setTimeout(r, 1500));
		socket.disconnect();

		expect(connectFired).toBe(false);
		expect(connectErrorFired).toBe(true);
		expect(errorMessage).toBe('Invalid or expired JWT');
		expect(getSessionCount()).toBe(0);
	});

	it('no token triggers connect_error', async () => {
		const { error } = await connectExpectError(baseUrl, {});

		expect(error).toBe('No JWT token');
		expect(getSessionCount()).toBe(0);
	});

	it('valid token triggers connect and init', async () => {
		const testAccountId = 'acct-jwt-recovery-' + Date.now();
		const token = createTestToken(testAccountId, 'testuser');

		const { socket, init } = await connectExpectInit(baseUrl, { token });

		expect(init.inLobby).toBe(false);
		expect(init.accountId).toBe(testAccountId);
		expect(init.playerId).toBe(testAccountId);
		expect(getSession(testAccountId)).toBeDefined();

		socket.disconnect();
	});

	it('token signed with wrong secret triggers connect_error', async () => {
		const wrongToken = jwt.sign(
			{ accountId: 'wrong-secret-acct', username: 'attacker' },
			'not-the-real-secret',
			{ expiresIn: '1h' }
		);

		const { error } = await connectExpectError(baseUrl, { token: wrongToken });

		expect(error).toBe('Invalid or expired JWT');
		expect(getSessionCount()).toBe(0);
	});

	it('expired token triggers connect_error', async () => {
		const expiredToken = jwt.sign(
			{ accountId: 'expired-acct', username: 'expired' },
			getJWTSecret(),
			{ expiresIn: '-1h' }
		);

		const { error } = await connectExpectError(baseUrl, { token: expiredToken });

		expect(error).toBe('Invalid or expired JWT');
		expect(getSessionCount()).toBe(0);
	});

	it('auth object with extra keys but no token triggers connect_error', async () => {
		const { error } = await connectExpectError(baseUrl, {
			playerId: 'some-id',
			username: 'ghost'
		});

		expect(error).toBe('No JWT token');
		expect(getSessionCount()).toBe(0);
	});
});
