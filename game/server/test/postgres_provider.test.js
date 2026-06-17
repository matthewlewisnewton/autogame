import { describe, it, expect, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import { PostgresProvider } from '../providers.js';
import { PLAYERS_SCHEMA_SQL, SETTINGS_SCHEMA_SQL } from '../db/ensurePlayersSchema.js';

const sampleData = {
	currency: 42,
	ownedCards: { iron_sword: 2, fireball: 1 },
	selectedDeck: ['iron_sword', 'iron_sword', 'fireball'],
};

const sampleSettings = {
	soundEnabled: false,
	particlesEnabled: true,
	lockOnRepeatAction: 'cycle',
};

function createProvider() {
	const db = newDb();
	db.public.none(PLAYERS_SCHEMA_SQL);
	db.public.none(SETTINGS_SCHEMA_SQL);
	const { Pool } = db.adapters.createPg();
	const pool = new Pool();
	const provider = new PostgresProvider({ pool, skipSchemaEnsure: true });
	return { pool, provider };
}

async function dispose({ pool, provider }) {
	await provider.close();
	await pool.end();
}

describe('PostgresProvider', () => {
	let ctx;

	afterEach(async () => {
		if (ctx) {
			await dispose(ctx);
			ctx = null;
		}
	});

	it('stores and retrieves player data', async () => {
		ctx = createProvider();
		await ctx.provider.savePlayer('player1', sampleData);
		expect(await ctx.provider.loadPlayer('player1')).toEqual(sampleData);
	});

	it('returns null for unknown player', async () => {
		ctx = createProvider();
		expect(await ctx.provider.loadPlayer('nonexistent')).toBeNull();
	});

	it('overwrites data on subsequent saves', async () => {
		ctx = createProvider();
		await ctx.provider.savePlayer('player1', sampleData);
		const updated = { ...sampleData, currency: 100 };
		await ctx.provider.savePlayer('player1', updated);
		expect(await ctx.provider.loadPlayer('player1')).toEqual(updated);
	});

	it('isolates data between different players', async () => {
		ctx = createProvider();
		await ctx.provider.savePlayer('player1', sampleData);
		await ctx.provider.savePlayer('player2', { ...sampleData, currency: 99 });
		expect((await ctx.provider.loadPlayer('player1')).currency).toBe(42);
		expect((await ctx.provider.loadPlayer('player2')).currency).toBe(99);
	});

	it('save returns a deep copy (mutations do not affect stored data)', async () => {
		ctx = createProvider();
		const data = {
			currency: 42,
			ownedCards: { iron_sword: 2, fireball: 1 },
			selectedDeck: ['iron_sword', 'iron_sword', 'fireball'],
		};
		await ctx.provider.savePlayer('player1', data);
		data.currency = 999;
		expect((await ctx.provider.loadPlayer('player1')).currency).toBe(42);
	});

	it('load returns a deep copy (mutations do not affect stored data)', async () => {
		ctx = createProvider();
		const data = { currency: 42, ownedCards: {}, selectedDeck: [] };
		await ctx.provider.savePlayer('player1', data);
		const loaded = await ctx.provider.loadPlayer('player1');
		loaded.currency = 999;
		expect((await ctx.provider.loadPlayer('player1')).currency).toBe(42);
	});

	it('close is a no-op when pool is injected', async () => {
		ctx = createProvider();
		await expect(ctx.provider.close()).resolves.toBeUndefined();
		await ctx.provider.savePlayer('player1', sampleData);
		expect(await ctx.provider.loadPlayer('player1')).toEqual(sampleData);
	});

	it('rejects a traversal playerId on save', async () => {
		ctx = createProvider();
		await expect(ctx.provider.savePlayer('../escaped', sampleData)).rejects.toThrow(/Invalid player id/);
	});

	it('rejects a traversal playerId on load', async () => {
		ctx = createProvider();
		await expect(ctx.provider.loadPlayer('../../etc/foo')).rejects.toThrow(/Invalid player id/);
	});

	it('rejects playerIds containing path separators or dots', async () => {
		ctx = createProvider();
		for (const bad of ['a/b', 'a.b', 'a\\b', '', '..']) {
			await expect(ctx.provider.savePlayer(bad, sampleData)).rejects.toThrow(/Invalid player id/);
		}
	});

	it('accepts UUID-shaped playerIds unchanged', async () => {
		ctx = createProvider();
		const uuid = '550e8400-e29b-41d4-a716-446655440000';
		await ctx.provider.savePlayer(uuid, sampleData);
		expect(await ctx.provider.loadPlayer(uuid)).toEqual(sampleData);
	});

	it('stores and retrieves settings', async () => {
		ctx = createProvider();
		await ctx.provider.saveSettings('acct1', sampleSettings);
		expect(await ctx.provider.loadSettings('acct1')).toEqual(sampleSettings);
	});

	it('returns null for unknown settings accountId', async () => {
		ctx = createProvider();
		expect(await ctx.provider.loadSettings('nonexistent')).toBeNull();
	});

	it('overwrites settings on subsequent saves', async () => {
		ctx = createProvider();
		await ctx.provider.saveSettings('acct1', sampleSettings);
		const updated = { ...sampleSettings, soundEnabled: true };
		await ctx.provider.saveSettings('acct1', updated);
		expect(await ctx.provider.loadSettings('acct1')).toEqual(updated);
	});

	it('isolates settings between different accounts', async () => {
		ctx = createProvider();
		await ctx.provider.saveSettings('acct1', sampleSettings);
		await ctx.provider.saveSettings('acct2', { ...sampleSettings, soundEnabled: true });
		expect((await ctx.provider.loadSettings('acct1')).soundEnabled).toBe(false);
		expect((await ctx.provider.loadSettings('acct2')).soundEnabled).toBe(true);
	});

	it('settings are independent from player data', async () => {
		ctx = createProvider();
		await ctx.provider.savePlayer('acct1', sampleData);
		await ctx.provider.saveSettings('acct1', sampleSettings);
		expect(await ctx.provider.loadPlayer('acct1')).toEqual(sampleData);
		expect(await ctx.provider.loadSettings('acct1')).toEqual(sampleSettings);
	});

	it('rejects a traversal accountId on settings save', async () => {
		ctx = createProvider();
		await expect(ctx.provider.saveSettings('../escaped', sampleSettings)).rejects.toThrow(/Invalid player id/);
	});

	it('rejects a traversal accountId on settings load', async () => {
		ctx = createProvider();
		await expect(ctx.provider.loadSettings('../../etc/foo')).rejects.toThrow(/Invalid player id/);
	});

	it('accepts UUID-shaped accountIds for settings', async () => {
		ctx = createProvider();
		const uuid = '550e8400-e29b-41d4-a716-446655440000';
		await ctx.provider.saveSettings(uuid, sampleSettings);
		expect(await ctx.provider.loadSettings(uuid)).toEqual(sampleSettings);
	});
});
