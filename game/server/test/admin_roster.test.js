import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import {
	startServer,
	resetGameState,
	io as serverIo,
	server as httpServer,
	clearAllTimers,
	setTestProvider
} from '../index.js';
import { InMemoryProvider } from '../providers.js';

// Same CJS module instances as index.js (ESM import would create duplicate stores).
const require = createRequire(import.meta.url);
const users = require('../users.js');
const { buildAdminRoster, requireAdminPassword } = require('../admin.js');

async function startTestServer() {
	if (httpServer.listening) {
		await new Promise((resolve) => httpServer.close(resolve));
	}
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('startTestServer: timed out')), 15000);
		resetGameState();
		serverIo.removeAllListeners('connection');
		clearAllTimers();
		users.clearUsers();
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

// Minimal Express-like req/res doubles for exercising the middleware directly.
function makeReq({ headers = {}, query = {} } = {}) {
	const lower = {};
	for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
	return {
		headers: lower,
		query,
		get(name) { return lower[String(name).toLowerCase()]; }
	};
}

function makeRes() {
	return {
		statusCode: null,
		body: null,
		status(code) { this.statusCode = code; return this; },
		json(payload) { this.body = payload; return this; }
	};
}

describe('admin roster + ADMIN_PASSWORD gate', () => {
	let provider;
	const ORIGINAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

	beforeEach(async () => {
		await startTestServer();
		users.clearUsers();
		provider = new InMemoryProvider();
		setTestProvider(provider);
		delete process.env.ADMIN_PASSWORD;
	});

	afterEach(async () => {
		setTestProvider(null);
		await closeTestServer();
		users.clearUsers();
		if (ORIGINAL_ADMIN_PASSWORD === undefined) {
			delete process.env.ADMIN_PASSWORD;
		} else {
			process.env.ADMIN_PASSWORD = ORIGINAL_ADMIN_PASSWORD;
		}
	});

	describe('getAllUsers()', () => {
		it('returns every created account as a copy without passwordHash', () => {
			users.createUser('alice', 'pw-alice');
			users.createUser('bob', 'pw-bob');

			const all = users.getAllUsers();
			const names = all.map((u) => u.username).sort();
			expect(names).toEqual(['alice', 'bob']);
			expect(all.every((u) => u.passwordHash === undefined)).toBe(true);

			// Copies must be detached — mutating the result does not touch the store.
			all[0].username = 'mutated';
			expect(users.findUserByUsername('alice')).not.toBeNull();
			expect(users.findUserByUsername('mutated')).toBeNull();
		});
	});

	describe('buildAdminRoster()', () => {
		it('joins persisted currency/deck for an account that has played', () => {
			users.createUser('player1', 'pw');
			const accountId = users.findUserByUsername('player1').accountId;
			provider.savePlayer(accountId, {
				currency: 250,
				inventory: [{ instanceId: 'i1', cardId: 'fireball' }],
				ownedCards: { fireball: 1 },
				selectedDeck: ['i1'],
				equippedKeyItemId: 'blink'
			});

			const roster = buildAdminRoster();
			const entry = roster.find((r) => r.username === 'player1');
			expect(entry).toBeDefined();
			expect(entry.accountId).toBe(accountId);
			expect(entry.currency).toBe(250);
			expect(entry.ownedCards).toEqual({ fireball: 1 });
			expect(entry.selectedDeck).toEqual(['i1']);
			expect(entry.equippedKeyItemId).toBe('blink');
			expect(entry.unlockedHats).toBeDefined();
			expect(entry.unlockedQuestTiers).toBeDefined();
			expect(entry.cosmetic).toBeDefined();
		});

		it('uses safe defaults for an account with no persisted player file', () => {
			users.createUser('newbie', 'pw');
			const accountId = users.findUserByUsername('newbie').accountId;
			// No savePlayer call — loadPlayer returns null.

			const roster = buildAdminRoster();
			const entry = roster.find((r) => r.username === 'newbie');
			expect(entry).toBeDefined();
			expect(entry.accountId).toBe(accountId);
			expect(entry.currency).toBe(0);
			expect(entry.inventory).toEqual([]);
			expect(entry.ownedCards).toEqual({});
			expect(entry.selectedDeck).toEqual([]);
			expect(entry.equippedKeyItemId).toBe('dodge_roll');
			expect(entry.email).toBeNull();
		});

		it('does not mutate stored accounts or persisted data', () => {
			users.createUser('immutable', 'pw');
			const accountId = users.findUserByUsername('immutable').accountId;
			provider.savePlayer(accountId, { currency: 99 });

			const roster = buildAdminRoster();
			roster[0].currency = -1;
			roster[0].username = 'hacked';

			expect(users.findUserByUsername('immutable')).not.toBeNull();
			expect(provider.loadPlayer(accountId).currency).toBe(99);
		});
	});

	describe('requireAdminPassword()', () => {
		it('denies all requests when ADMIN_PASSWORD is unset (fail closed)', () => {
			delete process.env.ADMIN_PASSWORD;
			const res = makeRes();
			let nextCalled = false;
			requireAdminPassword(makeReq({ headers: { 'x-admin-password': 'anything' } }), res, () => { nextCalled = true; });
			expect(nextCalled).toBe(false);
			expect(res.statusCode).toBe(403);
		});

		it('denies a wrong supplied password', () => {
			process.env.ADMIN_PASSWORD = 'secret';
			const res = makeRes();
			let nextCalled = false;
			requireAdminPassword(makeReq({ headers: { 'x-admin-password': 'wrong' } }), res, () => { nextCalled = true; });
			expect(nextCalled).toBe(false);
			expect(res.statusCode).toBe(403);
		});

		it('denies a missing supplied password', () => {
			process.env.ADMIN_PASSWORD = 'secret';
			const res = makeRes();
			let nextCalled = false;
			requireAdminPassword(makeReq(), res, () => { nextCalled = true; });
			expect(nextCalled).toBe(false);
			expect(res.statusCode).toBe(403);
		});

		it('allows the correct password via header', () => {
			process.env.ADMIN_PASSWORD = 'secret';
			const res = makeRes();
			let nextCalled = false;
			requireAdminPassword(makeReq({ headers: { 'x-admin-password': 'secret' } }), res, () => { nextCalled = true; });
			expect(nextCalled).toBe(true);
			expect(res.statusCode).toBeNull();
		});

		it('allows the correct password via ?password= query param', () => {
			process.env.ADMIN_PASSWORD = 'secret';
			const res = makeRes();
			let nextCalled = false;
			requireAdminPassword(makeReq({ query: { password: 'secret' } }), res, () => { nextCalled = true; });
			expect(nextCalled).toBe(true);
			expect(res.statusCode).toBeNull();
		});

		it('never consults the Authorization bearer header', () => {
			process.env.ADMIN_PASSWORD = 'secret';
			const res = makeRes();
			let nextCalled = false;
			requireAdminPassword(
				makeReq({ headers: { authorization: 'Bearer some.jwt.token' } }),
				res,
				() => { nextCalled = true; }
			);
			expect(nextCalled).toBe(false);
			expect(res.statusCode).toBe(403);
		});
	});
});
