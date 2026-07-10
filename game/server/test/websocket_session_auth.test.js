import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { io as ClientIO } from 'socket.io-client';
import { newDb } from 'pg-mem';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	setTestProvider,
	destroySession as serverDestroySession,
	findSocketByPlayerId,
} from '../index.js';
import { InMemoryProvider, PostgresProvider } from '../providers.js';
import { USERS_SCHEMA_SQL } from '../db/ensurePlayersSchema.js';
import { resetRedisForTests } from '../redis.js';

const require = createRequire(import.meta.url);
const { getSession: getLobbySession, getSessionCount } = require('../lobbies.js');
const { createSession, destroySession } = require('../sessions.js');
const { SESSION_COOKIE_NAME } = require('../cookies.js');
const { createUser, createUserAsync, clearUsers, clearUserCaches } = require('../users.js');
const { getRedisClient } = require('../redis.js');

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
 * Start a fresh server on a random port WITHOUT switching the provider.
 * Useful for cross-instance tests where the provider is set externally.
 */
async function startTestServerKeepProvider() {
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

	await startServer(0);
	const addr = httpServer.address();
	return `http://localhost:${addr.port}`;
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

	it('rejects connection when no session cookie is present', async () => {
		const { reason, error } = await connectExpectError(baseUrl);

		expect(reason).toBe('connect_error');
		expect(error).toBe('Missing or invalid session');
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

	it('disconnects an already-connected socket when its session is destroyed', async () => {
		const user = createTestUser('live-revocation-user');
		const sessionToken = await createSession(user.accountId);
		const { socket } = await connectWithSessionCookie(baseUrl, sessionToken);
		const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));

		expect(await destroySession(sessionToken)).toBe(true);
		await disconnected;

		expect(socket.connected).toBe(false);
		expect(getLobbySession(user.accountId)).toBeUndefined();
	});

	it('does not retain socket/session state when disconnect happens during setup', async () => {
		const user = createTestUser('disconnect-during-setup-user');
		const sessionToken = await createSession(user.accountId);
		const provider = new BlockingLoadProvider();
		setTestProvider(provider);
		provider.arm();

		const socket = ClientIO(baseUrl, {
			transports: ['websocket'],
			reconnection: false,
			extraHeaders: { cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` },
		});
		await new Promise((resolve) => socket.once('connect', resolve));
		await provider.hit;
		socket.disconnect();
		await new Promise((resolve) => setTimeout(resolve, 50));
		provider.release();
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(findSocketByPlayerId(user.accountId)).toBeNull();
		expect(getLobbySession(user.accountId)).toBeUndefined();
	});

	it('heartbeat disconnects a socket when its backing session disappeared', async () => {
		const user = createTestUser('heartbeat-expiry-user');
		const sessionToken = await createSession(user.accountId);
		const { socket } = await connectWithSessionCookie(baseUrl, sessionToken);
		await getRedisClient().del(`session:${sessionToken}`);
		const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));

		socket.emit('heartbeat', { timestamp: Date.now() });
		await disconnected;

		expect(socket.connected).toBe(false);
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

	it('cross-instance socket auth: user registered on A connects to B via lazy-load', async () => {
		// Close the server started by beforeEach (InMemoryProvider)
		await closeTestServer();

		// Shared pg-mem Postgres pool — both instances see the same data
		const db = newDb();
		db.public.none(USERS_SCHEMA_SQL);
		const { Pool } = db.adapters.createPg();
		const sharedPool = new Pool();

		const providerA = new PostgresProvider({ pool: sharedPool, skipSchemaEnsure: true });
		const providerB = new PostgresProvider({ pool: sharedPool, skipSchemaEnsure: true });

		// Reset Redis shim so sessions are shared between instances
		resetRedisForTests();

		// ── Instance A: register user and create session ──
		setTestProvider(providerA);
		const urlA = await startTestServerKeepProvider();
		const created = await createUserAsync('cross-instance-user', 'password123');
		expect(created.ok).toBe(true);
		const sessionToken = await createSession(created.accountId);

		// Verify session is stored and retrievable
		const { getSession } = require('../sessions.js');
		const sessionCheck = await getSession(sessionToken);
		expect(sessionCheck).not.toBeNull();
		expect(sessionCheck.accountId).toBe(created.accountId);

		// ── Simulate Instance B: switch provider, clear user cache ──
		// Instead of restarting the server (which resets Redis state),
		// we switch the provider and clear caches on the same server.
		// This tests the same lazy-load path the socket middleware uses.
		setTestProvider(providerB);
		require('../users.js').initUsersWithProvider(providerB);
		clearUserCaches();

		// Verify session is still retrievable (same Redis store)
		const sessionCheckB = await getSession(sessionToken);
		expect(sessionCheckB).not.toBeNull();
		expect(sessionCheckB.accountId).toBe(created.accountId);

		// Connect socket.io client with A-issued session cookie
		// The middleware will use findUserByAccountIdAsync() which lazy-loads
		// from providerB's Postgres (same pool as providerA)
		const { socket, init } = await connectWithSessionCookie(urlA, sessionToken);

		// Should receive init event (not connect_error) — lazy-load succeeded
		expect(init.accountId).toBe(created.accountId);
		expect(init.playerId).toBe(created.accountId);

		socket.disconnect();
		await closeTestServer();
		await providerA.close();
		await providerB.close();
		await sharedPool.end();
	});
});
