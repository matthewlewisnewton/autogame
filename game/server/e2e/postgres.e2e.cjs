// E2E: PostgresProvider against a REAL Postgres (DATABASE_URL from setup.e2e.js).
//
// Plain Node script, NOT a test-runner suite: the provider's sync methods use
// deasync (runSync), which busy-deadlocks when called inside a vitest/node:test
// `test()` callback but works correctly at a script's top level — exactly how the
// production server calls it. So we run the scenarios top-level and assert.
require('./setup.e2e.js');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PostgresProvider } = require('../providers.js');

const newId = () => randomUUID().replace(/-/g, '');
let pass = 0;
let fail = 0;
function check(name, fn) {
	try {
		fn();
		console.log(`  ok   - ${name}`);
		pass++;
	} catch (e) {
		console.error(`  FAIL - ${name}: ${e.message}`);
		fail++;
	}
}

// Constructing with a real URL also runs the schema migration against the DB.
const provider = new PostgresProvider(process.env.DATABASE_URL);

check('round-trips a player blob', () => {
	const id = newId();
	provider.savePlayer(id, { currency: 42, inventory: ['a', 'b'], dead: false });
	assert.deepEqual(provider.loadPlayer(id), { currency: 42, inventory: ['a', 'b'], dead: false });
});

check('upserts (last write wins) on the same player id', () => {
	const id = newId();
	provider.savePlayer(id, { hp: 1 });
	provider.savePlayer(id, { hp: 99, magicStones: 7 });
	assert.deepEqual(provider.loadPlayer(id), { hp: 99, magicStones: 7 });
});

check('persists across a fresh provider instance (restart durability)', () => {
	const id = newId();
	provider.savePlayer(id, { hp: 7, magicStones: 99, selectedDeck: ['x'] });
	const other = new PostgresProvider(process.env.DATABASE_URL);
	try {
		assert.deepEqual(other.loadPlayer(id), { hp: 7, magicStones: 99, selectedDeck: ['x'] });
	} finally {
		other.close();
	}
});

check('returns null for an unknown player', () => {
	assert.equal(provider.loadPlayer(newId()), null);
});

check('round-trips settings independently of player data', () => {
	const id = newId();
	provider.saveSettings(id, { volume: 0.5, invertY: true });
	assert.deepEqual(provider.loadSettings(id), { volume: 0.5, invertY: true });
	assert.equal(provider.loadPlayer(id), null);
});

provider.close();
console.log(`postgres e2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
