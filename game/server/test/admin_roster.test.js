import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The server is a CommonJS package and `adminRoster.js` reaches its
// collaborators via `require`. Under vitest, an ESM `import` of a CJS module
// yields a *different* instance than `require`, so seeding via ESM imports
// would populate a separate user store / provider than the one adminRoster
// reads. We load the modules under test through `require` to share the exact
// same singletons adminRoster uses.
const require = createRequire(import.meta.url);
const { buildAdminRoster } = require('../adminRoster.js');
const { createUser, findUserByUsername, clearUsers, setTestFilePath } = require('../users.js');
const { setTestProvider, getProvider } = require('../progression.js');
const { InMemoryProvider } = require('../providers.js');

let tmpUserFile;

beforeEach(() => {
	tmpUserFile = path.join(
		os.tmpdir(),
		`admin-roster-users-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}.json`
	);
	setTestFilePath(tmpUserFile);
	clearUsers();
	setTestProvider(new InMemoryProvider());
});

afterEach(() => {
	setTestProvider(null);
	clearUsers();
	try { fs.unlinkSync(tmpUserFile); } catch {}
});

function accountIdFor(username) {
	return findUserByUsername(username).accountId;
}

describe('buildAdminRoster', () => {
	it('returns [] for an empty store', () => {
		expect(buildAdminRoster()).toEqual([]);
	});

	it('surfaces a created account with username, cosmetic, and unlockedHats', () => {
		createUser('alice', 'pass123');

		const roster = buildAdminRoster();
		expect(roster).toHaveLength(1);
		const entry = roster[0];
		expect(entry.username).toBe('alice');
		expect(entry.accountId).toBe(accountIdFor('alice'));
		expect(entry.cosmetic).toBeDefined();
		expect(entry.equippedHat).toBe(entry.cosmetic.hat);
		expect(Array.isArray(entry.unlockedHats)).toBe(true);
		expect(entry.unlockedQuestTiers).toBeDefined();
	});

	it('surfaces persisted currency and selectedDeck for an account with player data', () => {
		createUser('bob', 'pass123');
		const accountId = accountIdFor('bob');
		getProvider().savePlayer(accountId, {
			currency: 250,
			ownedCards: { iron_sword: 2, flame_blade: 1 },
			selectedDeck: ['iron_sword', 'flame_blade']
		});

		const entry = buildAdminRoster().find((e) => e.username === 'bob');
		expect(entry.currency).toBe(250);
		expect(entry.selectedDeck).toEqual(['iron_sword', 'flame_blade']);
		expect(entry.ownedCards).toEqual({ iron_sword: 2, flame_blade: 1 });
	});

	it('uses safe defaults for an account with no persisted player data', () => {
		createUser('carol', 'pass123');

		const entry = buildAdminRoster().find((e) => e.username === 'carol');
		expect(entry.currency).toBe(0);
		expect(entry.selectedDeck).toEqual([]);
		expect(entry.ownedCards).toEqual({});
	});

	it('never includes passwordHash in any roster entry', () => {
		createUser('dave', 'pass123');
		createUser('erin', 'pass123');
		getProvider().savePlayer(accountIdFor('dave'), { currency: 5, ownedCards: {}, selectedDeck: [] });

		const roster = buildAdminRoster();
		expect(roster).toHaveLength(2);
		for (const entry of roster) {
			expect(entry).not.toHaveProperty('passwordHash');
		}
	});

	it('does not mutate user records or include passwordHash on the source record', () => {
		createUser('frank', 'pass123');
		const before = findUserByUsername('frank');
		const snapshot = JSON.stringify(before);

		buildAdminRoster();

		// Source record still carries its passwordHash and is unchanged.
		expect(before.passwordHash).toBeDefined();
		expect(JSON.stringify(findUserByUsername('frank'))).toBe(snapshot);
	});
});
