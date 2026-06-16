import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import { ensurePlayersSchema } from '../db/ensurePlayersSchema.js';

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
