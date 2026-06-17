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
const {
	_resetRateLimits,
	RATE_LIMIT_MAX_ATTEMPTS
} = require('../auth.js');

async function startTestServer() {
	if (httpServer.listening) {
		await new Promise((resolve) => httpServer.close(resolve));
	}
	resetGameState();
	serverIo.removeAllListeners('connection');
	clearAllTimers();
	users.clearUsers();
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

// Minimal Express-like req/res doubles for exercising the middleware directly.
function makeReq({ headers = {}, query = {}, ip = '127.0.0.1' } = {}) {
	const lower = {};
	for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
	return {
		headers: lower,
		query,
		ip,
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
	let baseUrl;
	const ORIGINAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

	beforeEach(async () => {
		baseUrl = await startTestServer();
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
		it('joins persisted currency/deck for an account that has played', async () => {
			users.createUser('player1', 'pw');
			const accountId = users.findUserByUsername('player1').accountId;
			await provider.savePlayer(accountId, {
				currency: 250,
				inventory: [{ instanceId: 'i1', cardId: 'fireball' }],
				ownedCards: { fireball: 1 },
				selectedDeck: ['i1'],
				equippedKeyItemId: 'blink'
			});

			const roster = await buildAdminRoster();
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

		it('uses safe defaults for an account with no persisted player file', async () => {
			users.createUser('newbie', 'pw');
			const accountId = users.findUserByUsername('newbie').accountId;
			// No savePlayer call — loadPlayer returns null.

			const roster = await buildAdminRoster();
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

		it('does not mutate stored accounts or persisted data', async () => {
			users.createUser('immutable', 'pw');
			const accountId = users.findUserByUsername('immutable').accountId;
			await provider.savePlayer(accountId, { currency: 99 });

			const roster = await buildAdminRoster();
			roster[0].currency = -1;
			roster[0].username = 'hacked';

			expect(users.findUserByUsername('immutable')).not.toBeNull();
			expect((await provider.loadPlayer(accountId)).currency).toBe(99);
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

		it('rejects the password via ?password= query param (security: URLs are logged)', () => {
			process.env.ADMIN_PASSWORD = 'secret';
			const res = makeRes();
			let nextCalled = false;
			requireAdminPassword(makeReq({ query: { password: 'secret' } }), res, () => { nextCalled = true; });
			expect(nextCalled).toBe(false);
			expect(res.statusCode).toBe(403);
		});

		it('rejects query param even when header is absent', () => {
			process.env.ADMIN_PASSWORD = 'secret';
			const res = makeRes();
			let nextCalled = false;
			requireAdminPassword(makeReq({ query: { password: 'secret' }, headers: {} }), res, () => { nextCalled = true; });
			expect(nextCalled).toBe(false);
			expect(res.statusCode).toBe(403);
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

	describe('GET /admin (HTTP route)', () => {
		async function seedRoster() {
			users.createUser('alice', 'pw-alice');
			users.createUser('bob', 'pw-bob');
			const aliceId = users.findUserByUsername('alice').accountId;
			const bobId = users.findUserByUsername('bob').accountId;
			// Equip a default-unlocked hat so the rendered page shows hat data.
			await users.updateProfile(aliceId, { cosmetic: { hat: 'bandana' } });
			return Promise.all([
				provider.savePlayer(aliceId, {
					currency: 1234,
					inventory: [{ instanceId: 'i1', cardId: 'fireball' }],
					ownedCards: { fireball: 2 },
					selectedDeck: ['i1'],
					equippedKeyItemId: 'blink'
				}),
				provider.savePlayer(bobId, { currency: 77, selectedDeck: [] }),
			]).then(() => ({ aliceId, bobId }));
		}

		it('renders every seeded account with currency/hat/deck data (200, text/html)', async () => {
			process.env.ADMIN_PASSWORD = 'topsecret';
			await seedRoster();

			const res = await fetch(`${baseUrl}/admin`, {
				headers: { 'x-admin-password': 'topsecret' }
			});
			expect(res.status).toBe(200);
			expect(res.headers.get('content-type')).toMatch(/text\/html/);

			const html = await res.text();
			expect(html).toContain('alice');
			expect(html).toContain('bob');
			expect(html).toContain('1234'); // alice currency
			expect(html).toContain('77'); // bob currency
			expect(html).toContain('bandana'); // alice equipped hat
			expect(html).toContain('fireball'); // owned card / inventory
			expect(html).toContain('blink'); // equipped key item
			// Password hashes must never leak into the page.
			expect(html).not.toContain('passwordHash');
		});

		it('rejects the admin password via ?password= query param (security: URLs are logged)', async () => {
			process.env.ADMIN_PASSWORD = 'topsecret';
			await seedRoster();

			const res = await fetch(`${baseUrl}/admin?password=topsecret`);
			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).not.toContain('alice');
		});

		it('returns 403 with no account data for a wrong password', async () => {
			process.env.ADMIN_PASSWORD = 'topsecret';
			await seedRoster();

			const res = await fetch(`${baseUrl}/admin`, {
				headers: { 'x-admin-password': 'wrong' }
			});
			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).not.toContain('alice');
			expect(body).not.toContain('1234');
		});

		it('returns 403 with no account data for a missing password', async () => {
			process.env.ADMIN_PASSWORD = 'topsecret';
			await seedRoster();

			const res = await fetch(`${baseUrl}/admin`);
			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).not.toContain('alice');
		});

		it('returns 403 when ADMIN_PASSWORD is unset (fail closed)', async () => {
			delete process.env.ADMIN_PASSWORD;
			await seedRoster();

			const res = await fetch(`${baseUrl}/admin`, {
				headers: { 'x-admin-password': 'anything' }
			});
			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).not.toContain('alice');
		});

		it('ignores a valid player Bearer token and still requires the admin password', async () => {
			process.env.ADMIN_PASSWORD = 'topsecret';
			await seedRoster();

			// A Bearer-only request (no admin password) must be denied.
			const res = await fetch(`${baseUrl}/admin`, {
				headers: { authorization: 'Bearer some.jwt.token' }
			});
			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).not.toContain('alice');
		});

		it('does not accept POST to /admin', async () => {
			process.env.ADMIN_PASSWORD = 'topsecret';
			await seedRoster();

			const res = await fetch(`${baseUrl}/admin`, {
				method: 'POST',
				headers: { 'x-admin-password': 'topsecret' }
			});
			// GET-only route — POST is never handled (404 from Express).
			expect(res.status).toBe(404);
		});
	});

	describe('requireAdminPassword() rate limiting', () => {
		const ORIGINAL_RATE_LIMIT_FLAG = process.env.AUTH_RATE_LIMIT_IN_TESTS;

		beforeEach(() => {
			process.env.AUTH_RATE_LIMIT_IN_TESTS = '1';
			process.env.ADMIN_PASSWORD = 'secret';
			_resetRateLimits();
		});

		afterEach(() => {
			_resetRateLimits();
			if (ORIGINAL_RATE_LIMIT_FLAG === undefined) {
				delete process.env.AUTH_RATE_LIMIT_IN_TESTS;
			} else {
				process.env.AUTH_RATE_LIMIT_IN_TESTS = ORIGINAL_RATE_LIMIT_FLAG;
			}
		});

		it('returns 429 after RATE_LIMIT_MAX_ATTEMPTS failed attempts from the same IP', () => {
			// Send RATE_LIMIT_MAX_ATTEMPTS failed requests
			for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
				const res = makeRes();
				let nextCalled = false;
				requireAdminPassword(
					makeReq({ headers: { 'x-admin-password': 'wrong' } }),
					res,
					() => { nextCalled = true; }
				);
				expect(nextCalled).toBe(false);
				expect(res.statusCode).toBe(403);
			}

			// The next attempt should be rate-limited (429)
			const res = makeRes();
			let nextCalled = false;
			requireAdminPassword(
				makeReq({ headers: { 'x-admin-password': 'wrong' } }),
				res,
				() => { nextCalled = true; }
			);
			expect(nextCalled).toBe(false);
			expect(res.statusCode).toBe(429);
			expect(res.body.error).toContain('Too many admin login attempts');
		});

		it('successful auth does not increment the rate-limit counter', () => {
			// Send 3 failed attempts
			for (let i = 0; i < 3; i++) {
				const res = makeRes();
				requireAdminPassword(
					makeReq({ headers: { 'x-admin-password': 'wrong' } }),
					res,
					() => {}
				);
				expect(res.statusCode).toBe(403);
			}

			// Successful auth — should NOT increment the counter
			const resOk = makeRes();
			let nextCalled = false;
			requireAdminPassword(
				makeReq({ headers: { 'x-admin-password': 'secret' } }),
				resOk,
				() => { nextCalled = true; }
			);
			expect(nextCalled).toBe(true);

			// Send 6 more failed attempts — total failure count is 9 (not 10)
			// If successful auth HAD incremented, the count would be 10 and the
			// next check would return 429. Because it didn't, the count is 9
			// and the next request with the correct password passes.
			for (let i = 0; i < 6; i++) {
				const res = makeRes();
				requireAdminPassword(
					makeReq({ headers: { 'x-admin-password': 'wrong' } }),
					res,
					() => {}
				);
				expect(res.statusCode).toBe(403);
			}

			// Correct password should pass through (bucket has 9, not 10)
			const resFinal = makeRes();
			let nextCalledFinal = false;
			requireAdminPassword(
				makeReq({ headers: { 'x-admin-password': 'secret' } }),
				resFinal,
				() => { nextCalledFinal = true; }
			);
			expect(nextCalledFinal).toBe(true);
			expect(resFinal.statusCode).toBeNull();
		});

		it('_resetRateLimits clears admin rate-limit buckets', () => {
			// Exhaust the rate limit
			for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
				const res = makeRes();
				requireAdminPassword(
					makeReq({ headers: { 'x-admin-password': 'wrong' } }),
					res,
					() => {}
				);
			}

			// Verify rate-limited
			const resBefore = makeRes();
			requireAdminPassword(
				makeReq({ headers: { 'x-admin-password': 'wrong' } }),
				resBefore,
				() => {}
			);
			expect(resBefore.statusCode).toBe(429);

			// Reset rate limits
			_resetRateLimits();

			// Should be able to authenticate again
			const resAfter = makeRes();
			let nextCalled = false;
			requireAdminPassword(
				makeReq({ headers: { 'x-admin-password': 'secret' } }),
				resAfter,
				() => { nextCalled = true; }
			);
			expect(nextCalled).toBe(true);
			expect(resAfter.statusCode).toBeNull();
		});
	});
});
