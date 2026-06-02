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
import { clearUsers, setTestFilePath } from '../users.js';
import { initAuth, resetAuthSecret } from '../auth.js';
import { clearAllSettings, resetSettingsPath } from '../settings.js';

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
	tmpUserFile = path.join(os.tmpdir(), `account-test-users-${Date.now()}.json`);
	tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'account-test-data-'));
	process.env.PERSISTENCE_PATH = tmpDataDir;
	setTestFilePath(tmpUserFile);
	clearUsers();
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
		expect(data.cosmetic).toEqual({
			bodyColor: '#4f8fdf',
			accentColor: '#f0c040',
			bodyShape: 'capsule'
		});
	});

	it('returns 401 without token', async () => {
		const res = await fetch(`${baseUrl}/api/me`);
		expect(res.status).toBe(401);
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

	it('updates cosmetic with a valid value and returns it', async () => {
		const token = await registerAndLogin('cosmo', 'pass');

		const res = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: authHeaders(token),
			body: JSON.stringify({ cosmetic: { bodyColor: '#123456', bodyShape: 'box' } })
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.cosmetic.bodyColor).toBe('#123456');
		expect(data.cosmetic.bodyShape).toBe('box');
		// Untouched key keeps its default.
		expect(data.cosmetic.accentColor).toBe('#f0c040');

		// GET reflects the persisted change.
		const me = await fetch(`${baseUrl}/api/me`, { headers: authHeaders(token) });
		const meData = await me.json();
		expect(meData.cosmetic.bodyColor).toBe('#123456');
		expect(meData.cosmetic.bodyShape).toBe('box');
	});

	it('rejects an invalid cosmetic with 400 and does not persist', async () => {
		const token = await registerAndLogin('cosmo2', 'pass');

		const res = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: authHeaders(token),
			body: JSON.stringify({ cosmetic: { bodyShape: 'sphere' } })
		});
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBeDefined();

		// Record unchanged — still defaults.
		const me = await fetch(`${baseUrl}/api/me`, { headers: authHeaders(token) });
		const meData = await me.json();
		expect(meData.cosmetic.bodyShape).toBe('capsule');
	});
});
