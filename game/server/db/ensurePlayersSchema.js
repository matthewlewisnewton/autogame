const fs = require('fs');
const path = require('path');

const PLAYERS_SCHEMA_SQL = fs.readFileSync(
	path.join(__dirname, '..', 'migrations', '001_players.sql'),
	'utf-8'
);

const SETTINGS_SCHEMA_SQL = fs.readFileSync(
	path.join(__dirname, '..', 'migrations', '002_settings.sql'),
	'utf-8'
);

/**
 * Apply the players table schema idempotently (safe to call on every startup).
 * @param {import('pg').Pool} pool
 */
async function ensurePlayersSchema(pool) {
	const { rows } = await pool.query(
		`SELECT 1 FROM information_schema.tables
		 WHERE table_schema = 'public' AND table_name = 'players'`
	);
	if (rows.length > 0) {
		return;
	}
	await pool.query(PLAYERS_SCHEMA_SQL);
}

/**
 * Apply the settings table schema idempotently (safe to call on every startup).
 * @param {import('pg').Pool} pool
 */
async function ensureSettingsSchema(pool) {
	const { rows } = await pool.query(
		`SELECT 1 FROM information_schema.tables
		 WHERE table_schema = 'public' AND table_name = 'settings'`
	);
	if (rows.length > 0) {
		return;
	}
	await pool.query(SETTINGS_SCHEMA_SQL);
}

module.exports = { PLAYERS_SCHEMA_SQL, ensurePlayersSchema, SETTINGS_SCHEMA_SQL, ensureSettingsSchema };
