import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';
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
import { clearAllSettings, resetSettingsPath } from '../settings.js';
import { PROPORTION_KEYS, PROPORTION_RANGES } from '../cosmetic.js';

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
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('startTestServer: timed out')), 15000);
		resetGameState();
		serverIo.removeAllListeners('connection');
		clearAllTimers();
		clearServerUsers();
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

async function closeTestServer() {
	if (!httpServer.listening) return;
	await new Promise((resolve) => {
		try { serverIo.close(); } catch (_) {}
		httpServer.close(() => resolve());
	});
}

function authHeaders(token) {
	return {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${token}`
	};
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
	const { token } = await loginRes.json();
	return token;
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
	resetSettingsPath();
	clearAllSettings();
	resetAuthSecret();
	initAuth();
	baseUrl = await startTestServer();
});

afterEach(async () => {
	await closeTestServer();
	delete process.env.PERSISTENCE_PATH;
	try { fs.unlinkSync(tmpUserFile); } catch {}
	try { fs.rmSync(tmpDataDir, { recursive: true, force: true }); } catch {}
});

describe('GET /api/me', () => {
	it('returns profile and default settings', async () => {
		const token = await registerAndLogin('alice', 'pass123');

		const res = await fetch(`${baseUrl}/api/me`, { headers: authHeaders(token) });
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

	it('returns modelIds array containing player model', async () => {
		const token = await registerAndLogin('modelUser', 'pass');

		const res = await fetch(`${baseUrl}/api/me`, { headers: authHeaders(token) });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.modelIds).toBeDefined();
		expect(Array.isArray(data.modelIds)).toBe(true);
		expect(data.modelIds).toContain('player');
	});

	it('returns proportionConfig with keys and ranges', async () => {
		const token = await registerAndLogin('propUser', 'pass');

		const res = await fetch(`${baseUrl}/api/me`, { headers: authHeaders(token) });
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
			headers: authHeaders(token),
			body: JSON.stringify({ particlesEnabled: false, showHitboxes: false })
		});
		expect(patchRes.status).toBe(200);
		const { settings } = await patchRes.json();
		expect(settings.particlesEnabled).toBe(false);
		expect(settings.showHitboxes).toBe(false);
		expect(settings.soundEnabled).toBe(true);
	});
});

describe('PATCH /api/me/profile', () => {
	it('updates email with uniqueness check', async () => {
		const daveToken = await registerAndLogin('dave', 'pass');
		await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: authHeaders(daveToken),
			body: JSON.stringify({ email: 'dave@example.com' })
		});

		const carolToken = await registerAndLogin('carol', 'pass');

		const conflict = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: authHeaders(carolToken),
			body: JSON.stringify({ email: 'dave@example.com' })
		});
		expect(conflict.status).toBe(409);

		const ok = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: authHeaders(carolToken),
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
			headers: authHeaders(token),
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
			headers: authHeaders(token),
			body: JSON.stringify({ cosmetic: { bodyColor: '#0a0b0c', bodyShape: 'capsule' } })
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.cosmetic.bodyColor).toBe('#0a0b0c');
		expect(data.cosmetic.bodyShape).toBe('capsule');
		expect(data.cosmetic.accentColor).toBe('#f2c94c');

		// Confirms it is reflected on GET /me as well.
		const meRes = await fetch(`${baseUrl}/api/me`, { headers: authHeaders(token) });
		const me = await meRes.json();
		expect(me.cosmetic.bodyColor).toBe('#0a0b0c');
	});

	it('returns 400 for invalid cosmetic input', async () => {
		const token = await registerAndLogin('cosmo2', 'pass');

		const res = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: authHeaders(token),
			body: JSON.stringify({ cosmetic: { bodyShape: 'pyramid' } })
		});
		expect(res.status).toBe(400);
	});

	it('updates cosmetic modelId and proportions and persists correctly', async () => {
		const token = await registerAndLogin('cosmo3', 'pass');

		const res = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: authHeaders(token),
			body: JSON.stringify({ cosmetic: { modelId: 'player', proportions: { height: 1.1 } } })
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.cosmetic.modelId).toBe('player');
		expect(data.cosmetic.proportions.height).toBe(1.1);
		// Other proportions remain at default.
		expect(data.cosmetic.proportions.headSize).toBe(1.0);

		// Verify it is reflected on subsequent GET /me.
		const meRes = await fetch(`${baseUrl}/api/me`, { headers: authHeaders(token) });
		const me = await meRes.json();
		expect(me.cosmetic.modelId).toBe('player');
		expect(me.cosmetic.proportions.height).toBe(1.1);
	});
});
