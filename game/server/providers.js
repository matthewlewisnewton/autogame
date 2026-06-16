// Concrete storage providers — InMemory (dev/test), File (production), Postgres (multi-instance).

const { StorageProvider } = require('./storage');
const { Pool } = require('pg');
const deasync = require('deasync');
const { ensurePlayersSchema } = require('./db/ensurePlayersSchema');
const fs = require('fs');
const path = require('path');

/**
 * Block until a promise settles. Callers expect synchronous savePlayer/loadPlayer.
 * @template T
 * @param {Promise<T>} promise
 * @returns {T}
 */
function runSync(promise) {
	let done = false;
	let result;
	let error;
	promise.then(
		(value) => {
			result = value;
			done = true;
		},
		(err) => {
			error = err;
			done = true;
		}
	);
	deasync.loopWhile(() => !done);
	if (error) throw error;
	return result;
}

// Safe storage-key shape: matches server-issued UUIDs and other simple keys.
// Used as a last-line guard against path traversal even if a forged/leaked
// token carries an accountId like "../../etc/foo".
const SAFE_PLAYER_ID_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * Reject any playerId that could escape basePath when joined into a filename.
 * Defense-in-depth alongside the auth-boundary validation in account.js/index.js.
 * @param {string} playerId
 * @returns {string} the validated playerId
 */
function assertSafePlayerId(playerId) {
	if (typeof playerId !== 'string' || !SAFE_PLAYER_ID_REGEX.test(playerId)) {
		throw new Error(`Invalid player id: ${JSON.stringify(playerId)}`);
	}
	return playerId;
}

/**
 * In-memory provider — data lives in a Map and is lost on process exit.
 * Used for tests and development.
 */
class InMemoryProvider extends StorageProvider {
	constructor() {
		super();
		this.store = new Map();
	}

	savePlayer(playerId, data) {
		this.store.set(playerId, JSON.parse(JSON.stringify(data)));
	}

	loadPlayer(playerId) {
		const entry = this.store.get(playerId);
		return entry !== undefined ? JSON.parse(JSON.stringify(entry)) : null;
	}

	close() {
		// no-op
	}
}

/**
 * File-based provider — writes one JSON file per player with atomic rename
 * to prevent corruption on crash.
 *
 * Data path: {basePath}/{playerId}.json
 */
class FileProvider extends StorageProvider {
	constructor(basePath) {
		super();
		this.basePath = basePath;
		fs.mkdirSync(basePath, { recursive: true });
	}

	savePlayer(playerId, data) {
		assertSafePlayerId(playerId);
		const json = JSON.stringify(data, null, 2);
		const finalPath = path.join(this.basePath, `${playerId}.json`);
		// Unique per-write tmp name (mirrors users.js saveUsers) so concurrent
		// saves for the same player cannot clobber each other's temp file.
		const tmpPath = `${finalPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

		try {
			fs.writeFileSync(tmpPath, json, 'utf-8');
			fs.renameSync(tmpPath, finalPath);
		} catch (err) {
			try { fs.unlinkSync(tmpPath); } catch (_) {}
			throw err;
		}
	}

	loadPlayer(playerId) {
		assertSafePlayerId(playerId);
		const filePath = path.join(this.basePath, `${playerId}.json`);
		try {
			const raw = fs.readFileSync(filePath, 'utf-8');
			return JSON.parse(raw);
		} catch (err) {
			if (err.code === 'ENOENT') return null;
			throw err;
		}
	}

	close() {
		// no-op — no open handles to release
	}
}

/**
 * Postgres-backed provider — persists player blobs to the players table.
 * Used for multi-instance hosting with a shared DATABASE_URL.
 */
class PostgresProvider extends StorageProvider {
	/**
	 * @param {string | { pool: import('pg').Pool, skipSchemaEnsure?: boolean }} databaseUrlOrOptions
	 *   Connection string (DATABASE_URL) or test hook `{ pool, skipSchemaEnsure }`.
	 * @param {{ pool?: import('pg').Pool, skipSchemaEnsure?: boolean }} [options]
	 */
	constructor(databaseUrlOrOptions, options = {}) {
		super();
		let databaseUrl;
		if (
			databaseUrlOrOptions &&
			typeof databaseUrlOrOptions === 'object' &&
			databaseUrlOrOptions.pool
		) {
			options = databaseUrlOrOptions;
		} else {
			databaseUrl = databaseUrlOrOptions;
		}

		if (options.pool) {
			this.pool = options.pool;
			this._ownsPool = false;
		} else {
			if (!databaseUrl) {
				throw new Error('PostgresProvider requires DATABASE_URL or an injectable pool');
			}
			this.pool = new Pool({ connectionString: databaseUrl });
			this._ownsPool = true;
		}
		this._closed = false;
		if (!options.skipSchemaEnsure) {
			runSync(ensurePlayersSchema(this.pool));
		}
	}

	savePlayer(playerId, data) {
		assertSafePlayerId(playerId);
		const copy = JSON.parse(JSON.stringify(data));
		runSync(
			this.pool.query(
				`INSERT INTO players (player_id, data) VALUES ($1, $2::jsonb)
				 ON CONFLICT (player_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
				[playerId, JSON.stringify(copy)]
			)
		);
	}

	loadPlayer(playerId) {
		assertSafePlayerId(playerId);
		const { rows } = runSync(
			this.pool.query(`SELECT data FROM players WHERE player_id = $1`, [playerId])
		);
		if (rows.length === 0) return null;
		return JSON.parse(JSON.stringify(rows[0].data));
	}

	close() {
		if (!this._ownsPool || this._closed) return;
		this._closed = true;
		try {
			runSync(this.pool.end());
		} catch (_) {
			// pool may already be ended
		}
	}
}

module.exports = {
	InMemoryProvider,
	FileProvider,
	PostgresProvider,
	assertSafePlayerId,
	SAFE_PLAYER_ID_REGEX,
};
