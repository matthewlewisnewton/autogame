// E2E: PostgresProvider against a REAL Postgres (DATABASE_URL from setup.e2e.js).
require('./setup.e2e.js');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PostgresProvider } = require('../providers.js');

const newId = () => randomUUID().replace(/-/g, '');

(async () => {
	let pass = 0;
	let fail = 0;

	async function check(name, fn) {
		try {
			await fn();
			console.log(`  ok   - ${name}`);
			pass++;
		} catch (e) {
			console.error(`  FAIL - ${name}: ${e.message}`);
			fail++;
		}
	}

	const provider = await PostgresProvider.create(process.env.DATABASE_URL);

	await check('round-trips a player blob', async () => {
		const id = newId();
		await provider.savePlayer(id, { currency: 42, inventory: ['a', 'b'], dead: false });
		assert.deepEqual(await provider.loadPlayer(id), { currency: 42, inventory: ['a', 'b'], dead: false });
	});

	await check('upserts (last write wins) on the same player id', async () => {
		const id = newId();
		await provider.savePlayer(id, { hp: 1 });
		await provider.savePlayer(id, { hp: 99, magicStones: 7 });
		assert.deepEqual(await provider.loadPlayer(id), { hp: 99, magicStones: 7 });
	});

	await check('persists across a fresh provider instance (restart durability)', async () => {
		const id = newId();
		await provider.savePlayer(id, { hp: 7, magicStones: 99, selectedDeck: ['x'] });
		const other = await PostgresProvider.create(process.env.DATABASE_URL);
		try {
			assert.deepEqual(await other.loadPlayer(id), { hp: 7, magicStones: 99, selectedDeck: ['x'] });
		} finally {
			await other.close();
		}
	});

	await check('returns null for an unknown player', async () => {
		assert.equal(await provider.loadPlayer(newId()), null);
	});

	await check('round-trips settings independently of player data', async () => {
		const id = newId();
		await provider.saveSettings(id, { volume: 0.5, invertY: true });
		assert.deepEqual(await provider.loadSettings(id), { volume: 0.5, invertY: true });
		assert.equal(await provider.loadPlayer(id), null);
	});

	await provider.close();
	console.log(`postgres e2e: ${pass} passed, ${fail} failed`);
	process.exit(fail ? 1 : 0);
})().catch((err) => {
	console.error('postgres e2e fatal:', err);
	process.exit(1);
});
