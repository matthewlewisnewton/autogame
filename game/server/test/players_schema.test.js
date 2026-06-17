import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import { ensurePlayersSchema, ensureSettingsSchema, ensureUsersSchema } from '../db/ensurePlayersSchema.js';

describe('players schema', () => {
	let pool;

	beforeEach(async () => {
		const db = newDb();
		const { Pool } = db.adapters.createPg();
		pool = new Pool();
		await ensurePlayersSchema(pool);
	});

	afterEach(async () => {
		await pool.end();
	});

	it('creates the players table idempotently', async () => {
		const first = await pool.query(
			`SELECT 1 FROM information_schema.tables
			 WHERE table_schema = 'public' AND table_name = 'players'`
		);
		expect(first.rowCount).toBe(1);

		await ensurePlayersSchema(pool);

		const second = await pool.query(
			`SELECT 1 FROM information_schema.tables
			 WHERE table_schema = 'public' AND table_name = 'players'`
		);
		expect(second.rowCount).toBe(1);
	});

	it('round-trips a sample player document', async () => {
		const sample = {
			currency: 42,
			ownedCards: { iron_sword: 2, fireball: 1 },
			selectedDeck: ['iron_sword', 'iron_sword', 'fireball'],
		};

		await pool.query(
			`INSERT INTO players (player_id, data) VALUES ($1, $2::jsonb)`,
			['player1', JSON.stringify(sample)]
		);

		const { rows } = await pool.query(
			`SELECT data FROM players WHERE player_id = $1`,
			['player1']
		);

		expect(rows).toHaveLength(1);
		expect(rows[0].data).toEqual(sample);
	});
});

describe('settings schema', () => {
	let pool;

	beforeEach(async () => {
		const db = newDb();
		const { Pool } = db.adapters.createPg();
		pool = new Pool();
		await ensureSettingsSchema(pool);
	});

	afterEach(async () => {
		await pool.end();
	});

	it('creates the settings table idempotently', async () => {
		const first = await pool.query(
			`SELECT 1 FROM information_schema.tables
			 WHERE table_schema = 'public' AND table_name = 'settings'`
		);
		expect(first.rowCount).toBe(1);

		await ensureSettingsSchema(pool);

		const second = await pool.query(
			`SELECT 1 FROM information_schema.tables
			 WHERE table_schema = 'public' AND table_name = 'settings'`
		);
		expect(second.rowCount).toBe(1);
	});

	it('round-trips a sample settings document', async () => {
		const sample = {
			soundEnabled: false,
			particlesEnabled: true,
			lockOnRepeatAction: 'cycle',
		};

		await pool.query(
			`INSERT INTO settings (account_id, data) VALUES ($1, $2::jsonb)`,
			['acct1', JSON.stringify(sample)]
		);

		const { rows } = await pool.query(
			`SELECT data FROM settings WHERE account_id = $1`,
			['acct1']
		);

		expect(rows).toHaveLength(1);
		expect(rows[0].data).toEqual(sample);
	});

	it('upserts settings on conflict', async () => {
		await pool.query(
			`INSERT INTO settings (account_id, data) VALUES ($1, $2::jsonb)
			 ON CONFLICT (account_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
			['acct1', JSON.stringify({ soundEnabled: false })]
		);

		await pool.query(
			`INSERT INTO settings (account_id, data) VALUES ($1, $2::jsonb)
			 ON CONFLICT (account_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
			['acct1', JSON.stringify({ soundEnabled: true, particlesEnabled: false })]
		);

		const { rows } = await pool.query(
			`SELECT data FROM settings WHERE account_id = $1`,
			['acct1']
		);

		expect(rows).toHaveLength(1);
		expect(rows[0].data).toEqual({ soundEnabled: true, particlesEnabled: false });
	});
});

describe('users schema', () => {
	let pool;

	beforeEach(async () => {
		const db = newDb();
		const { Pool } = db.adapters.createPg();
		pool = new Pool();
		await ensureUsersSchema(pool);
	});

	afterEach(async () => {
		await pool.end();
	});

	it('creates the users table idempotently', async () => {
		const first = await pool.query(
			`SELECT 1 FROM information_schema.tables
			 WHERE table_schema = 'public' AND table_name = 'users'`
		);
		expect(first.rowCount).toBe(1);

		await ensureUsersSchema(pool);

		const second = await pool.query(
			`SELECT 1 FROM information_schema.tables
			 WHERE table_schema = 'public' AND table_name = 'users'`
		);
		expect(second.rowCount).toBe(1);
	});

	it('round-trips a sample user document', async () => {
		const sample = {
			passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
			cosmetic: { hat: 'default', color: 'blue' },
			unlockedHats: ['default'],
			unlockedQuestTiers: { training_caverns: [2] },
			completedQuestTiers: { training_caverns: [1] },
			email: 'player@example.com',
		};

		await pool.query(
			`INSERT INTO users (username, account_id, data) VALUES ($1, $2, $3::jsonb)`,
			['alice', 'acct-alice-001', JSON.stringify(sample)]
		);

		const { rows } = await pool.query(
			`SELECT data FROM users WHERE username = $1`,
			['alice']
		);

		expect(rows).toHaveLength(1);
		expect(rows[0].data).toEqual(sample);
	});

	it('enforces account_id uniqueness', async () => {
		const sample = { passwordHash: 'hash1' };

		await pool.query(
			`INSERT INTO users (username, account_id, data) VALUES ($1, $2, $3::jsonb)`,
			['user_a', 'shared-acct', JSON.stringify(sample)]
		);

		await expect(
			pool.query(
				`INSERT INTO users (username, account_id, data) VALUES ($1, $2, $3::jsonb)`,
				['user_b', 'shared-acct', JSON.stringify({ passwordHash: 'hash2' })]
			)
		).rejects.toThrow();
	});
});
