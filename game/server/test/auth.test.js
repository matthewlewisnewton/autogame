import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	getJWTSecret
} from '../index.js';
import { clearUsers, setTestFilePath } from '../users.js';
import { initAuth, resetAuthSecret } from '../auth.js';
import jwt from 'jsonwebtoken';

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
	await new Promise((resolve) => {
		try { serverIo.close(); } catch (_) {}
		httpServer.close(() => { clearTimeout(resolve); resolve(); });
	});
}

let baseUrl;
let tmpUserFile;

beforeEach(async () => {
	tmpUserFile = path.join(os.tmpdir(), `auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
	setTestFilePath(tmpUserFile);
	clearUsers();
	baseUrl = await startTestServer();
});

afterEach(async () => {
	await closeTestServer();
	// Clean up temp user file
	try { fs.unlinkSync(tmpUserFile); } catch {}
	try { fs.unlinkSync(tmpUserFile + '.tmp'); } catch {}
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
});

// ── POST /api/login ──

describe('POST /api/login', () => {
	it('returns 200 with JWT token on success', async () => {
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
		expect(data.token).toBeDefined();
		expect(typeof data.token).toBe('string');
	});

	it('returns a JWT containing accountId and username', async () => {
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

		// Decode JWT — verify with the secret the auth module is using (test-secret in NODE_ENV=test)
		const decoded = jwt.verify(loginData.token, getJWTSecret());
		expect(decoded.accountId).toBe(regData.accountId);
		expect(decoded.username).toBe('carol');
	});

	it('JWT token has ~24h expiration', async () => {
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

		const decoded = jwt.verify(data.token, getJWTSecret());
		const now = Math.floor(Date.now() / 1000);
		// exp should be roughly 24h from iat
		expect(decoded.exp - decoded.iat).toBe(86400);
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

// ── initAuth() dev fallback ──

describe('initAuth() dev fallback', () => {
	const origNodeEnv = process.env.NODE_ENV;
	const origJwtSecret = process.env.JWT_SECRET;

	beforeEach(() => {
		resetAuthSecret();
		delete process.env.JWT_SECRET;
	});

	afterEach(() => {
		process.env.NODE_ENV = origNodeEnv;
		process.env.JWT_SECRET = origJwtSecret;
		resetAuthSecret();
	});

	it('uses dev fallback secret when NODE_ENV is not test or production', () => {
		process.env.NODE_ENV = 'development';
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
});
