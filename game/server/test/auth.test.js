import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
} from '../index.js';
import { setServerUsersFilePath, clearServerUsers } from './helpers.js';

// Use createRequire to get the same CJS auth instance that index.js uses.
// Vitest loads CJS modules twice (ESM import vs CJS require), so direct
// ESM imports of auth.js would read a different module instance than the
// one index.js manipulates via require('./auth').
const requireCJS = createRequire(import.meta.url);
const auth = requireCJS('../auth.js');
const {
	initAuth,
	resetAuthSecret,
	_resetRateLimits,
	_rateLimitBuckets,
	RATE_LIMIT_WINDOW_MS,
	pruneExpiredBuckets,
	getRateLimitSweepInterval,
	getJWTSecret,
	verifyToken,
} = auth;
const jwt = requireCJS('jsonwebtoken');

const { SESSION_COOKIE_NAME } = requireCJS('../cookies.js');
const { getSession } = requireCJS('../sessions.js');

// ── Helpers ──

/**
 * Start a fresh server on a random port and return the base URL.
 */
async function startTestServer() {
	// Close any existing server
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
	clearServerUsers();

	await startServer(0);
	const addr = httpServer.address();
	return `http://localhost:${addr.port}`;
}

/**
 * Extract the opaque session token from a fetch Response `Set-Cookie` header(s).
 */
function extractSessionTokenFromResponse(res) {
	const setCookies = typeof res.headers.getSetCookie === 'function'
		? res.headers.getSetCookie()
		: [res.headers.get('set-cookie')].filter(Boolean);

	for (const cookie of setCookies) {
		const prefix = `${SESSION_COOKIE_NAME}=`;
		if (cookie.startsWith(prefix)) {
			return cookie.slice(prefix.length).split(';')[0].trim();
		}
	}
	return null;
}

/**
 * Assert Set-Cookie uses the expected session cookie attributes (non-production).
 */
function expectSessionCookieAttributes(setCookieValue) {
	expect(setCookieValue).toContain(`${SESSION_COOKIE_NAME}=`);
	expect(setCookieValue).toContain('Path=/');
	expect(setCookieValue).toContain('HttpOnly');
	expect(setCookieValue).toContain('SameSite=Lax');
	expect(setCookieValue).not.toContain('Secure');
}

/**
 * Assert the response body includes a valid JWT for socket auth.
 */
function expectValidJwtToken(data, expectedAccountId, expectedUsername) {
	expect(data.token).toBeDefined();
	expect(typeof data.token).toBe('string');
	expect(data.token.length).toBeGreaterThan(0);

	const decoded = jwt.verify(data.token, getJWTSecret());
	expect(decoded.accountId).toBe(expectedAccountId);
	expect(decoded.username).toBe(expectedUsername);

	const viaVerifyToken = verifyToken(data.token);
	expect(viaVerifyToken).not.toBeNull();
	expect(viaVerifyToken.accountId).toBe(expectedAccountId);
	expect(viaVerifyToken.username).toBe(expectedUsername);
}

/**
 * Close the HTTP server.
 */
async function closeTestServer() {
	if (!httpServer.listening) return;
	await new Promise((resolve) => {
		try { serverIo.close(); } catch (_) {}
		httpServer.close(() => { clearTimeout(resolve); resolve(); });
	});
}

let baseUrl;
let tmpUserFile;

beforeEach(async () => {
	tmpUserFile = path.join(os.tmpdir(), `auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
	setServerUsersFilePath(tmpUserFile);
	clearServerUsers();
	baseUrl = await startTestServer();
});

afterEach(async () => {
	await closeTestServer();
	// Clean up temp user file
	try { fs.unlinkSync(tmpUserFile); } catch {}
});

// ── POST /api/register ──

describe('POST /api/register', () => {
	it('returns 201 with accountId on success', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'alice', password: 'secret123' })
		});
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.accountId).toBeDefined();
		expect(typeof data.accountId).toBe('string');
		expectValidJwtToken(data, data.accountId, 'alice');

		const sessionToken = extractSessionTokenFromResponse(res);
		expect(sessionToken).toBeTruthy();

		const setCookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')].filter(Boolean);
		const sessionCookie = setCookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
		expect(sessionCookie).toBeDefined();
		expectSessionCookieAttributes(sessionCookie);

		const session = await getSession(sessionToken);
		expect(session).not.toBeNull();
		expect(session.accountId).toBe(data.accountId);
	});

	it('returns 409 when username is already taken', async () => {
		// First registration
		const res1 = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'bob', password: 'pass1' })
		});
		expect(res1.status).toBe(201);

		// Duplicate
		const res2 = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'bob', password: 'pass2' })
		});
		expect(res2.status).toBe(409);
		const data = await res2.json();
		expect(data.error).toBe('Username taken');
	});

	it('returns 400 when username is missing', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: 'secret' })
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when password is missing', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'alice' })
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when both fields are missing', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when username is less than 3 characters', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'ab', password: 'secret' })
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when username is more than 32 characters', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username: 'a'.repeat(33),
				password: 'secret'
			})
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when password is empty string', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'alice', password: '' })
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when username is not a string', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 123, password: 'secret' })
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when password is not a string', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'alice', password: 456 })
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when password exceeds the maximum length', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'longpw', password: 'a'.repeat(257) })
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toMatch(/at most/i);
	});

	it('accepts a password at exactly the maximum length', async () => {
		const res = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'maxpw', password: 'a'.repeat(256) })
		});
		expect(res.status).toBe(201);
	});
});

// ── POST /api/login ──

describe('POST /api/login', () => {
	it('returns 200 with session cookie on success', async () => {
		// Register first
		await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'alice', password: 'secret123' })
		});

		const res = await fetch(`${baseUrl}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'alice', password: 'secret123' })
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expectValidJwtToken(data, data.accountId, 'alice');
		expect(data.accountId).toBeDefined();
		expect(typeof data.accountId).toBe('string');

		const sessionToken = extractSessionTokenFromResponse(res);
		expect(sessionToken).toBeTruthy();

		const setCookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')].filter(Boolean);
		const sessionCookie = setCookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
		expect(sessionCookie).toBeDefined();
		expectSessionCookieAttributes(sessionCookie);

		const session = await getSession(sessionToken);
		expect(session).not.toBeNull();
		expect(session.accountId).toBe(data.accountId);
	});

	it('returns 400 when login password exceeds the maximum length', async () => {
		await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'loginmax', password: 'secret123' })
		});
		const res = await fetch(`${baseUrl}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'loginmax', password: 'a'.repeat(257) })
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toMatch(/at most/i);
	});

	it('session cookie maps to the registered accountId', async () => {
		// Register and get accountId
		const regRes = await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'carol', password: 'pass' })
		});
		const regData = await regRes.json();

		// Login
		const loginRes = await fetch(`${baseUrl}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'carol', password: 'pass' })
		});
		const loginData = await loginRes.json();
		expectValidJwtToken(loginData, regData.accountId, 'carol');
		expect(loginData.accountId).toBe(regData.accountId);

		const sessionToken = extractSessionTokenFromResponse(loginRes);
		const session = await getSession(sessionToken);
		expect(session.accountId).toBe(regData.accountId);
	});

	it('creates a Redis session record on login', async () => {
		await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'dave', password: 'pass' })
		});

		const res = await fetch(`${baseUrl}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'dave', password: 'pass' })
		});
		const data = await res.json();
		expectValidJwtToken(data, data.accountId, 'dave');

		const sessionToken = extractSessionTokenFromResponse(res);
		const session = await getSession(sessionToken);
		expect(session).not.toBeNull();
		expect(session.accountId).toBe(data.accountId);
		expect(session.createdAt).toBeDefined();
		expect(session.lastSeen).toBeDefined();
	});

	it('returns 401 for unknown username', async () => {
		const res = await fetch(`${baseUrl}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'nobody', password: 'pass' })
		});
		expect(res.status).toBe(401);
		const data = await res.json();
		expect(data.error).toBe('Invalid credentials');
	});

	it('returns 401 for wrong password', async () => {
		await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'eve', password: 'correct' })
		});

		const res = await fetch(`${baseUrl}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'eve', password: 'wrong' })
		});
		expect(res.status).toBe(401);
		const data = await res.json();
		expect(data.error).toBe('Invalid credentials');
	});

	it('returns 400 when username is missing', async () => {
		const res = await fetch(`${baseUrl}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: 'secret' })
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when password is missing', async () => {
		const res = await fetch(`${baseUrl}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'alice' })
		});
		expect(res.status).toBe(400);
	});
});

// ── POST /api/logout ──

function cookieHeaders(sessionToken) {
	return {
		'Content-Type': 'application/json',
		Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
	};
}

describe('POST /api/logout', () => {
	it('revokes the session so /api/me returns 401 afterward', async () => {
		await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'logout-user', password: 'secret123' }),
		});

		const loginRes = await fetch(`${baseUrl}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'logout-user', password: 'secret123' }),
		});
		expect(loginRes.status).toBe(200);
		const sessionToken = extractSessionTokenFromResponse(loginRes);
		expect(sessionToken).toBeTruthy();

		const meBefore = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(sessionToken) });
		expect(meBefore.status).toBe(200);

		const logoutRes = await fetch(`${baseUrl}/api/logout`, {
			method: 'POST',
			headers: cookieHeaders(sessionToken),
		});
		expect(logoutRes.status).toBe(204);

		const setCookies = logoutRes.headers.getSetCookie?.() ?? [logoutRes.headers.get('set-cookie')].filter(Boolean);
		const cleared = setCookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
		expect(cleared).toBeDefined();
		expect(cleared).toContain('Max-Age=0');

		const meAfter = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(sessionToken) });
		expect(meAfter.status).toBe(401);
	});

	it('removes the session key from Redis after logout', async () => {
		await fetch(`${baseUrl}/api/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'redis-revoke', password: 'secret123' }),
		});

		const loginRes = await fetch(`${baseUrl}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'redis-revoke', password: 'secret123' }),
		});
		const sessionToken = extractSessionTokenFromResponse(loginRes);
		expect(sessionToken).toBeTruthy();

		const sessionBefore = await getSession(sessionToken);
		expect(sessionBefore).not.toBeNull();

		await fetch(`${baseUrl}/api/logout`, {
			method: 'POST',
			headers: cookieHeaders(sessionToken),
		});

		const sessionAfter = await getSession(sessionToken);
		expect(sessionAfter).toBeNull();
	});

	it('returns 204 when no session cookie is present', async () => {
		const res = await fetch(`${baseUrl}/api/logout`, { method: 'POST' });
		expect(res.status).toBe(204);
	});
});

// ── initAuth() dev fallback ──

describe('initAuth() dev fallback', () => {
	const origNodeEnv = process.env.NODE_ENV;
	const origJwtSecret = process.env.JWT_SECRET;
	const origAllowDevAuth = process.env.ALLOW_DEV_AUTH;
	const origPort = process.env.PORT;

	beforeEach(() => {
		resetAuthSecret();
		delete process.env.JWT_SECRET;
		delete process.env.ALLOW_DEV_AUTH;
		delete process.env.PORT;
	});

	afterEach(() => {
		process.env.NODE_ENV = origNodeEnv;
		process.env.JWT_SECRET = origJwtSecret;
		process.env.ALLOW_DEV_AUTH = origAllowDevAuth;
		if (origPort === undefined) {
			delete process.env.PORT;
		} else {
			process.env.PORT = origPort;
		}
		resetAuthSecret();
	});

	it('throws in dev mode with PORT but without ALLOW_DEV_AUTH', () => {
		process.env.NODE_ENV = 'development';
		process.env.PORT = '3000';
		expect(() => initAuth()).toThrow('Missing JWT_SECRET');
	});

	it('uses dev fallback secret when ALLOW_DEV_AUTH=1', () => {
		process.env.NODE_ENV = 'development';
		process.env.ALLOW_DEV_AUTH = '1';
		const secret = initAuth();
		expect(secret).toBe('dev-secret');
	});

	it('throws when NODE_ENV is production and JWT_SECRET is missing', () => {
		process.env.NODE_ENV = 'production';
		expect(() => initAuth()).toThrow('Missing JWT_SECRET');
	});

	it('accepts JWT_SECRET from environment regardless of NODE_ENV', () => {
		process.env.NODE_ENV = 'development';
		process.env.JWT_SECRET = 'custom-secret';
		const secret = initAuth();
		expect(secret).toBe('custom-secret');
	});

	it('uses test-secret in NODE_ENV=test without requiring ALLOW_DEV_AUTH', () => {
		process.env.NODE_ENV = 'test';
		const secret = initAuth();
		expect(secret).toBe('test-secret');
	});

	it('JWT_SECRET env value takes precedence over ALLOW_DEV_AUTH', () => {
		process.env.NODE_ENV = 'development';
		process.env.JWT_SECRET = 'custom-secret';
		process.env.ALLOW_DEV_AUTH = '1';
		const secret = initAuth();
		expect(secret).toBe('custom-secret');
	});
});

// ── Rate-limit bucket pruning ──

describe('pruneExpiredBuckets()', () => {
	beforeEach(() => {
		_resetRateLimits();
	});

	afterEach(() => {
		_resetRateLimits();
	});

	it('removes entries older than RATE_LIMIT_WINDOW_MS', () => {
		const expiredKey = 'login:127.0.0.1:olduser';
		_rateLimitBuckets.set(expiredKey, {
			windowStart: Date.now() - RATE_LIMIT_WINDOW_MS - 1000,
			attempts: 5
		});
		expect(_rateLimitBuckets.size).toBe(1);

		pruneExpiredBuckets();

		expect(_rateLimitBuckets.size).toBe(0);
		expect(_rateLimitBuckets.has(expiredKey)).toBe(false);
	});

	it('preserves entries still within their window', () => {
		const activeKey = 'login:127.0.0.1:activeuser';
		_rateLimitBuckets.set(activeKey, {
			windowStart: Date.now() - 5000, // 5s ago — well within 60s window
			attempts: 3
		});
		expect(_rateLimitBuckets.size).toBe(1);

		pruneExpiredBuckets();

		expect(_rateLimitBuckets.size).toBe(1);
		expect(_rateLimitBuckets.has(activeKey)).toBe(true);
	});

	it('removes only expired entries when mix of expired and active', () => {
		const expiredKey = 'register:10.0.0.1:expired';
		const activeKey = 'login:10.0.0.1:active';

		_rateLimitBuckets.set(expiredKey, {
			windowStart: Date.now() - RATE_LIMIT_WINDOW_MS - 5000,
			attempts: 10
		});
		_rateLimitBuckets.set(activeKey, {
			windowStart: Date.now() - 10000, // 10s ago — within window
			attempts: 2
		});
		expect(_rateLimitBuckets.size).toBe(2);

		pruneExpiredBuckets();

		expect(_rateLimitBuckets.size).toBe(1);
		expect(_rateLimitBuckets.has(expiredKey)).toBe(false);
		expect(_rateLimitBuckets.has(activeKey)).toBe(true);
	});
});

describe('rate-limit sweep interval', () => {
	it('sweep interval is active after server starts', () => {
		// startTestServer() in beforeEach calls startServer(0), which calls
		// clearAllTimers() (stops any prior sweep) then restartBackgroundTimers()
		// then startRateLimitSweep(). The sweep interval should be truthy,
		// proving the sweep survived the full startup sequence.
		expect(getRateLimitSweepInterval()).toBeDefined();
		expect(Boolean(getRateLimitSweepInterval())).toBe(true);
	});
});
