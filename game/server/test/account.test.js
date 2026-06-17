import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createRequire } from 'module';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	getJWTSecret
} from '../index.js';
import { setServerUsersFilePath, clearServerUsers } from './helpers.js';
import { initAuth, resetAuthSecret } from '../auth.js';
import { PROPORTION_KEYS, PROPORTION_RANGES } from '../cosmetic.js';

const require = createRequire(import.meta.url);
// Vitest loads settings.js twice (ESM import vs CJS require); HTTP routes use the CJS instance.
const serverSettings = require('../settings.js');
const { SESSION_COOKIE_NAME } = require('../cookies.js');
const { SESSION_KEY_PREFIX, SESSION_TTL_SECONDS } = require('../sessions.js');
const { getRedisClient } = require('../redis.js');

async function startTestServer() {
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

async function closeTestServer() {
	if (!httpServer.listening) return;
	await new Promise((resolve) => {
		try { serverIo.close(); } catch (_) {}
		httpServer.close(() => resolve());
	});
}

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

function cookieHeaders(sessionToken) {
	return {
		'Content-Type': 'application/json',
		Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
	};
}

async function createSessionWithAccountId(accountId) {
	const token = crypto.randomBytes(32).toString('base64url');
	const now = new Date().toISOString();
	const redis = getRedisClient();
	const key = `${SESSION_KEY_PREFIX}${token}`;
	await redis.hset(key, { accountId, createdAt: now, lastSeen: now });
	await redis.expire(key, SESSION_TTL_SECONDS);
	return token;
}

async function registerAndLogin(username, password) {
	const regRes = await fetch(`${baseUrl}/api/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});
	expect(regRes.status).toBe(201);
	const loginRes = await fetch(`${baseUrl}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});
	expect(loginRes.status).toBe(200);
	const sessionToken = extractSessionTokenFromResponse(loginRes);
	expect(sessionToken).toBeTruthy();
	return sessionToken;
}

let baseUrl;
let tmpUserFile;
let tmpDataDir;

beforeEach(async () => {
	tmpUserFile = path.join(os.tmpdir(), `account-test-users-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
	tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'account-test-data-'));
	process.env.PERSISTENCE_PATH = tmpDataDir;
	setServerUsersFilePath(tmpUserFile);
	clearServerUsers();
	serverSettings.resetSettingsPath();
	serverSettings.clearAllSettings();
	resetAuthSecret();
	initAuth();
	baseUrl = await startTestServer();
});

afterEach(async () => {
	serverSettings.resetSettingsMaxBytesForTests();
	await closeTestServer();
	delete process.env.PERSISTENCE_PATH;
	try { fs.unlinkSync(tmpUserFile); } catch {}
	try { fs.rmSync(tmpDataDir, { recursive: true, force: true }); } catch {}
});

describe('GET /api/me', () => {
	it('returns profile and default settings', async () => {
		const token = await registerAndLogin('alice', 'pass123');

		const res = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(token) });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.username).toBe('alice');
		expect(data.settings.soundEnabled).toBe(true);
		expect(data.settings.showHitboxes).toBe(true);
		expect(data.email).toBeNull();
		expect(data.cosmetic).toEqual({ bodyColor: '#4f9dde', accentColor: '#f2c94c', bodyShape: 'box', hat: 'none', modelId: 'player', proportions: { height: 1.0, headSize: 1.0, torsoWidth: 1.0, armLength: 1.0, legLength: 1.0, shoulderWidth: 1.0 } });
	});

	it('returns 401 without token', async () => {
		const res = await fetch(`${baseUrl}/api/me`);
		expect(res.status).toBe(401);
	});

	it('rejects a session whose accountId is a traversal string', async () => {
		const evilToken = await createSessionWithAccountId('../../etc/passwd');
		const res = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(evilToken) });
		expect(res.status).toBe(401);
	});

	it('rejects settings PATCH with a traversal accountId in the session', async () => {
		const evilToken = await createSessionWithAccountId('a/../b');
		const res = await fetch(`${baseUrl}/api/me/settings`, {
			method: 'PATCH',
			headers: cookieHeaders(evilToken),
			body: JSON.stringify({ soundEnabled: false })
		});
		expect(res.status).toBe(401);
	});

	it('returns 401 for an unknown session token', async () => {
		const res = await fetch(`${baseUrl}/api/me`, {
			headers: cookieHeaders('not-a-real-session-token'),
		});
		expect(res.status).toBe(401);
	});

	it('returns modelIds array containing player model', async () => {
		const token = await registerAndLogin('modelUser', 'pass');

		const res = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(token) });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.modelIds).toBeDefined();
		expect(Array.isArray(data.modelIds)).toBe(true);
		expect(data.modelIds).toContain('player');
	});

	it('returns proportionConfig with keys and ranges', async () => {
		const token = await registerAndLogin('propUser', 'pass');

		const res = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(token) });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.proportionConfig).toBeDefined();
		expect(data.proportionConfig.keys).toEqual(PROPORTION_KEYS);
		for (const key of PROPORTION_KEYS) {
			expect(data.proportionConfig.ranges[key]).toEqual(PROPORTION_RANGES[key]);
		}
	});
});

describe('PATCH /api/me/settings', () => {
	it('updates and returns merged settings', async () => {
		const token = await registerAndLogin('bob', 'pass');

		const patchRes = await fetch(`${baseUrl}/api/me/settings`, {
			method: 'PATCH',
			headers: cookieHeaders(token),
			body: JSON.stringify({ particlesEnabled: false, showHitboxes: false })
		});
		expect(patchRes.status).toBe(200);
		const { settings } = await patchRes.json();
		expect(settings.particlesEnabled).toBe(false);
		expect(settings.showHitboxes).toBe(false);
		expect(settings.soundEnabled).toBe(true);
	});

	it('returns 400 for invalid settings fields', async () => {
		const token = await registerAndLogin('settings-invalid', 'pass');

		const patchRes = await fetch(`${baseUrl}/api/me/settings`, {
			method: 'PATCH',
			headers: cookieHeaders(token),
			body: JSON.stringify({ lockOnRepeatAction: 'teleport' })
		});
		expect(patchRes.status).toBe(400);
		const body = await patchRes.json();
		expect(body.error).toMatch(/lockOnRepeatAction/);

		const meRes = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(token) });
		const me = await meRes.json();
		expect(me.settings.lockOnRepeatAction).toBe('unlock');
	});

	it('returns 400 when settings would exceed the size cap', async () => {
		const token = await registerAndLogin('settings-cap', 'pass');

		const okRes = await fetch(`${baseUrl}/api/me/settings`, {
			method: 'PATCH',
			headers: cookieHeaders(token),
			body: JSON.stringify({ soundEnabled: false }),
		});
		expect(okRes.status).toBe(200);

		serverSettings.setSettingsMaxBytesForTests(100);

		const patchRes = await fetch(`${baseUrl}/api/me/settings`, {
			method: 'PATCH',
			headers: cookieHeaders(token),
			body: JSON.stringify({ particlesEnabled: false }),
		});
		expect(patchRes.status).toBe(400);
		const body = await patchRes.json();
		expect(body.error).toMatch(/exceed maximum size/i);

		serverSettings.resetSettingsMaxBytesForTests();
		const meRes = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(token) });
		const me = await meRes.json();
		expect(me.settings.soundEnabled).toBe(false);
		expect(me.settings.particlesEnabled).toBe(true);
	});

	it('does not persist unknown keys from PATCH body', async () => {
		const token = await registerAndLogin('settings-prune', 'pass');

		const patchRes = await fetch(`${baseUrl}/api/me/settings`, {
			method: 'PATCH',
			headers: cookieHeaders(token),
			body: JSON.stringify({ soundEnabled: false, hackerField: 'nope' })
		});
		expect(patchRes.status).toBe(200);
		const { settings } = await patchRes.json();
		expect(settings.soundEnabled).toBe(false);
		expect(settings.hackerField).toBeUndefined();

		const meRes = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(token) });
		const me = await meRes.json();
		expect(me.settings.soundEnabled).toBe(false);
		expect(me.settings.hackerField).toBeUndefined();
	});
});

describe('PATCH /api/me/profile', () => {
	it('updates email with uniqueness check', async () => {
		const daveToken = await registerAndLogin('dave', 'pass');
		await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: cookieHeaders(daveToken),
			body: JSON.stringify({ email: 'dave@example.com' })
		});

		const carolToken = await registerAndLogin('carol', 'pass');

		const conflict = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: cookieHeaders(carolToken),
			body: JSON.stringify({ email: 'dave@example.com' })
		});
		expect(conflict.status).toBe(409);

		const ok = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: cookieHeaders(carolToken),
			body: JSON.stringify({ email: 'carol@example.com' })
		});
		expect(ok.status).toBe(200);
		const body = await ok.json();
		expect(body.email).toBe('carol@example.com');
	});

	it('changes username and returns new token', async () => {
		const token = await registerAndLogin('eve', 'pass');

		const res = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: cookieHeaders(token),
			body: JSON.stringify({ username: 'eve2' })
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.username).toBe('eve2');
		expect(data.token).toBeDefined();
		const decoded = jwt.verify(data.token, getJWTSecret());
		expect(decoded.username).toBe('eve2');
	});

	it('updates cosmetic and returns it in the 200 payload', async () => {
		const token = await registerAndLogin('cosmo', 'pass');

		const res = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: cookieHeaders(token),
			body: JSON.stringify({ cosmetic: { bodyColor: '#0a0b0c', bodyShape: 'capsule' } })
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.cosmetic.bodyColor).toBe('#0a0b0c');
		expect(data.cosmetic.bodyShape).toBe('capsule');
		expect(data.cosmetic.accentColor).toBe('#f2c94c');

		// Confirms it is reflected on GET /me as well.
		const meRes = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(token) });
		const me = await meRes.json();
		expect(me.cosmetic.bodyColor).toBe('#0a0b0c');
	});

	it('returns 400 for invalid cosmetic input', async () => {
		const token = await registerAndLogin('cosmo2', 'pass');

		const res = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: cookieHeaders(token),
			body: JSON.stringify({ cosmetic: { bodyShape: 'pyramid' } })
		});
		expect(res.status).toBe(400);
	});

	it('updates cosmetic modelId and proportions and persists correctly', async () => {
		const token = await registerAndLogin('cosmo3', 'pass');

		const res = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: cookieHeaders(token),
			body: JSON.stringify({ cosmetic: { modelId: 'player', proportions: { height: 1.1 } } })
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.cosmetic.modelId).toBe('player');
		expect(data.cosmetic.proportions.height).toBe(1.1);
		// Other proportions remain at default.
		expect(data.cosmetic.proportions.headSize).toBe(1.0);

		// Verify it is reflected on subsequent GET /me.
		const meRes = await fetch(`${baseUrl}/api/me`, { headers: cookieHeaders(token) });
		const me = await meRes.json();
		expect(me.cosmetic.modelId).toBe('player');
		expect(me.cosmetic.proportions.height).toBe(1.1);
	});
});
