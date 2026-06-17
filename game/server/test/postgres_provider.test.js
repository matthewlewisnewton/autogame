import { describe, it, expect, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import { PostgresProvider } from '../providers.js';
import { PLAYERS_SCHEMA_SQL, SETTINGS_SCHEMA_SQL, USERS_SCHEMA_SQL } from '../db/ensurePlayersSchema.js';

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

const sampleUser = {
	username: 'alice',
	passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
	accountId: 'acct-alice-001',
	cosmetic: {
		bodyShape: 'box',
		modelId: 'player',
		proportions: {
			height: 1,
			headSize: 1,
			torsoWidth: 1,
			armLength: 1,
			legLength: 1,
			shoulderWidth: 1,
		},
		hat: 'none',
		color: 'blue',
	},
	unlockedHats: ['none', 'bandana', 'beanie'],
	unlockedQuestTiers: {},
	completedQuestTiers: {},
};

function createProvider() {
	const db = newDb();
	db.public.none(PLAYERS_SCHEMA_SQL);
	db.public.none(SETTINGS_SCHEMA_SQL);
	db.public.none(USERS_SCHEMA_SQL);
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

describe('PostgresProvider user store', () => {
	let ctx;

	afterEach(async () => {
		if (ctx) {
			await dispose(ctx);
			ctx = null;
		}
	});

	it('stores and retrieves user records', async () => {
		ctx = createProvider();
		await ctx.provider.saveUser(sampleUser);
		expect(await ctx.provider.loadUser('alice')).toEqual(sampleUser);
	});

	it('returns null for unknown username', async () => {
		ctx = createProvider();
		expect(await ctx.provider.loadUser('nonexistent')).toBeNull();
	});

	it('stores and retrieves user records by accountId', async () => {
		ctx = createProvider();
		await ctx.provider.saveUser(sampleUser);
		expect(await ctx.provider.loadUserByAccountId('acct-alice-001')).toEqual(sampleUser);
	});

	it('returns null for unknown accountId', async () => {
		ctx = createProvider();
		expect(await ctx.provider.loadUserByAccountId('nonexistent')).toBeNull();
	});

	it('overwrites user data on subsequent saves', async () => {
		ctx = createProvider();
		await ctx.provider.saveUser(sampleUser);
		const updated = {
			...sampleUser,
			unlockedQuestTiers: { training_caverns: [2] },
		};
		await ctx.provider.saveUser(updated);
		expect(await ctx.provider.loadUser('alice')).toEqual(updated);
	});

	it('isolates data between different users', async () => {
		ctx = createProvider();
		await ctx.provider.saveUser(sampleUser);
		const bob = {
			...sampleUser,
			username: 'bob',
			accountId: 'acct-bob-002',
		};
		await ctx.provider.saveUser(bob);
		expect((await ctx.provider.loadUser('alice')).accountId).toBe('acct-alice-001');
		expect((await ctx.provider.loadUser('bob')).accountId).toBe('acct-bob-002');
	});

	it('loadAllUsers returns every stored record', async () => {
		ctx = createProvider();
		await ctx.provider.saveUser(sampleUser);
		await ctx.provider.saveUser({
			...sampleUser,
			username: 'bob',
			accountId: 'acct-bob-002',
		});
		const all = await ctx.provider.loadAllUsers();
		expect(all).toHaveLength(2);
		expect(all.map((u) => u.username).sort()).toEqual(['alice', 'bob']);
	});

	it('loadAllUsers returns an empty array when no users exist', async () => {
		ctx = createProvider();
		expect(await ctx.provider.loadAllUsers()).toEqual([]);
	});

	it('deleteUser removes a stored record', async () => {
		ctx = createProvider();
		await ctx.provider.saveUser(sampleUser);
		await ctx.provider.deleteUser('alice');
		expect(await ctx.provider.loadUser('alice')).toBeNull();
		expect(await ctx.provider.loadAllUsers()).toEqual([]);
	});

	it('accepts UUID-shaped accountIds', async () => {
		ctx = createProvider();
		const uuid = '550e8400-e29b-41d4-a716-446655440000';
		const user = { ...sampleUser, accountId: uuid };
		await ctx.provider.saveUser(user);
		expect((await ctx.provider.loadUser('alice')).accountId).toBe(uuid);
	});

	it('rejects a traversal username on save', async () => {
		ctx = createProvider();
		await expect(
			ctx.provider.saveUser({ ...sampleUser, username: '../escaped' })
		).rejects.toThrow(/Invalid username/);
	});

	it('rejects a traversal username on load', async () => {
		ctx = createProvider();
		await expect(ctx.provider.loadUser('../../etc/foo')).rejects.toThrow(/Invalid username/);
	});

	it('rejects a traversal accountId on save', async () => {
		ctx = createProvider();
		await expect(
			ctx.provider.saveUser({ ...sampleUser, accountId: '../escaped' })
		).rejects.toThrow(/Invalid accountId/);
	});

	it('save returns a deep copy (mutations do not affect stored data)', async () => {
		ctx = createProvider();
		const user = JSON.parse(JSON.stringify(sampleUser));
		await ctx.provider.saveUser(user);
		user.cosmetic.color = 'red';
		expect((await ctx.provider.loadUser('alice')).cosmetic.color).toBe('blue');
	});

	it('load returns a deep copy (mutations do not affect stored data)', async () => {
		ctx = createProvider();
		await ctx.provider.saveUser(sampleUser);
		const loaded = await ctx.provider.loadUser('alice');
		loaded.cosmetic.color = 'red';
		expect((await ctx.provider.loadUser('alice')).cosmetic.color).toBe('blue');
	});

	it('loadUserByAccountId returns user record when accountId matches', async () => {
		ctx = createProvider();
		await ctx.provider.saveUser(sampleUser);
		const loaded = await ctx.provider.loadUserByAccountId('acct-alice-001');
		expect(loaded).toEqual(sampleUser);
	});

	it('loadUserByAccountId returns null for unknown accountId', async () => {
		ctx = createProvider();
		expect(await ctx.provider.loadUserByAccountId('nonexistent')).toBeNull();
	});

	it('loadUserByAccountId returns null when no users exist', async () => {
		ctx = createProvider();
		expect(await ctx.provider.loadUserByAccountId('acct-alice-001')).toBeNull();
	});

	it('loadUserByAccountId returns deep copy', async () => {
		ctx = createProvider();
		await ctx.provider.saveUser(sampleUser);
		const loaded = await ctx.provider.loadUserByAccountId('acct-alice-001');
		loaded.cosmetic.color = 'red';
		const again = await ctx.provider.loadUserByAccountId('acct-alice-001');
		expect(again.cosmetic.color).toBe('blue');
	});

	it('loadUserByAccountId matches only correct accountId among multiple users', async () => {
		ctx = createProvider();
		await ctx.provider.saveUser(sampleUser);
		const bob = { ...sampleUser, username: 'bob', accountId: 'acct-bob-002' };
		await ctx.provider.saveUser(bob);
		expect((await ctx.provider.loadUserByAccountId('acct-alice-001')).username).toBe('alice');
		expect((await ctx.provider.loadUserByAccountId('acct-bob-002')).username).toBe('bob');
	});

	it('loadUserByAccountId rejects a traversal accountId', async () => {
		ctx = createProvider();
		await expect(ctx.provider.loadUserByAccountId('../escaped')).rejects.toThrow(/Invalid accountId/);
	});
});
