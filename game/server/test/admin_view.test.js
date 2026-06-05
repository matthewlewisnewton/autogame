import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers
} from '../index.js';

// The server is a CommonJS package and `adminView.js` / `adminRoster.js` reach
// their collaborators via `require`. Under vitest an ESM `import` of a CJS
// module can yield a *different* instance than `require`, so we seed accounts
// and player data through `require` to share the exact singletons the route
// reads.
const require = createRequire(import.meta.url);
const { createUser, findUserByUsername, clearUsers, setTestFilePath } = require('../users.js');
const { setTestProvider, getProvider } = require('../progression.js');
const { InMemoryProvider } = require('../providers.js');
const jwt = require('jsonwebtoken');

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

const ADMIN_PASSWORD = 'super-secret-admin-pw';

let baseUrl;
let tmpUserFile;
let savedAdminPassword;

beforeEach(async () => {
	savedAdminPassword = process.env.ADMIN_PASSWORD;
	process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
	tmpUserFile = path.join(
		os.tmpdir(),
		`admin-view-users-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}.json`
	);
	setTestFilePath(tmpUserFile);
	clearUsers();
	setTestProvider(new InMemoryProvider());
	baseUrl = await startTestServer();
});

afterEach(async () => {
	await closeTestServer();
	setTestProvider(null);
	clearUsers();
	if (savedAdminPassword === undefined) {
		delete process.env.ADMIN_PASSWORD;
	} else {
		process.env.ADMIN_PASSWORD = savedAdminPassword;
	}
	try { fs.unlinkSync(tmpUserFile); } catch {}
});

function seedAccount(username, playerData) {
	createUser(username, 'pass123');
	const accountId = findUserByUsername(username).accountId;
	if (playerData) {
		getProvider().savePlayer(accountId, playerData);
	}
	return accountId;
}

describe('GET /admin', () => {
	it('returns 200 + HTML listing a seeded account with the correct password (query param)', async () => {
		seedAccount('alice', { currency: 250, ownedCards: { iron_sword: 1 }, selectedDeck: ['iron_sword'] });

		const res = await fetch(`${baseUrl}/admin?password=${encodeURIComponent(ADMIN_PASSWORD)}`);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toMatch(/text\/html/);
		const body = await res.text();
		expect(body).toContain('alice');
		expect(body).toContain('250');
	});

	it('accepts the password via the X-Admin-Password header', async () => {
		seedAccount('bob');

		const res = await fetch(`${baseUrl}/admin`, {
			headers: { 'X-Admin-Password': ADMIN_PASSWORD }
		});
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('bob');
	});

	it('escapes account-derived strings so a username cannot inject markup', async () => {
		seedAccount('<script>alert(1)</script>');

		const res = await fetch(`${baseUrl}/admin?password=${encodeURIComponent(ADMIN_PASSWORD)}`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).not.toContain('<script>alert(1)</script>');
		expect(body).toContain('&lt;script&gt;');
	});

	it('returns 401 and no account data for a wrong password', async () => {
		seedAccount('carol');

		const res = await fetch(`${baseUrl}/admin?password=wrong`);
		expect(res.status).toBe(401);
		const body = await res.text();
		expect(body).not.toContain('carol');
	});

	it('returns 401 when no password is supplied', async () => {
		seedAccount('dave');

		const res = await fetch(`${baseUrl}/admin`);
		expect(res.status).toBe(401);
		const body = await res.text();
		expect(body).not.toContain('dave');
	});

	it('denies every request when ADMIN_PASSWORD is unset/empty', async () => {
		seedAccount('erin');
		delete process.env.ADMIN_PASSWORD;

		const noPw = await fetch(`${baseUrl}/admin`);
		expect([401, 403]).toContain(noPw.status);
		expect(await noPw.text()).not.toContain('erin');

		// Even supplying the previously-correct password is denied.
		const withPw = await fetch(`${baseUrl}/admin?password=${encodeURIComponent(ADMIN_PASSWORD)}`);
		expect([401, 403]).toContain(withPw.status);
		expect(await withPw.text()).not.toContain('erin');
	});

	it('does not grant access via a valid player JWT alone (no admin password)', async () => {
		const accountId = seedAccount('frank');
		const token = jwt.sign({ accountId, username: 'frank' }, 'any-secret', { expiresIn: '1h' });

		const res = await fetch(`${baseUrl}/admin`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		expect(res.status).toBe(401);
		const body = await res.text();
		expect(body).not.toContain('frank');
	});
});
