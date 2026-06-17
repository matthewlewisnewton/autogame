// Concrete storage providers — InMemory (dev/test), File (production), Postgres (multi-instance).

const { StorageProvider } = require('./storage');
const { Pool } = require('pg');
const {
	ensurePlayersSchema,
	ensureSettingsSchema,
	ensureUsersSchema,
} = require('./db/ensurePlayersSchema');
const fs = require('fs');
const path = require('path');

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
 * Reject usernames/accountIds that could escape basePath or carry traversal segments.
 * Mirrors assertSafePlayerId — defense-in-depth for user-store keys.
 * @param {string} key
 * @param {string} label
 * @returns {string}
 */
function assertSafeStorageKey(key, label = 'storage key') {
	if (typeof key !== 'string' || !SAFE_PLAYER_ID_REGEX.test(key)) {
		throw new Error(`Invalid ${label}: ${JSON.stringify(key)}`);
	}
	return key;
}

function usersFilePath(basePath) {
	return path.join(basePath, 'users.json');
}

function readUsersArray(filePath) {
	try {
		const raw = fs.readFileSync(filePath, 'utf-8');
		const records = JSON.parse(raw);
		if (!Array.isArray(records)) {
			throw new Error('users file must contain a JSON array');
		}
		return records;
	} catch (err) {
		if (err.code === 'ENOENT') return [];
		throw err;
	}
}

function writeUsersArrayAtomic(filePath, records) {
	const json = JSON.stringify(records, null, 2);
	const dir = path.dirname(filePath);
	fs.mkdirSync(dir, { recursive: true });
	const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
	try {
		fs.writeFileSync(tmpPath, json, 'utf-8');
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		try { fs.unlinkSync(tmpPath); } catch (_) {}
		throw err;
	}
}

/**
 * In-memory provider — data lives in a Map and is lost on process exit.
 * Used for tests and development.
 */
class InMemoryProvider extends StorageProvider {
	constructor() {
		super();
		this.store = new Map();
		this.settingsStore = new Map();
		this.usersStore = new Map();
	}

	async savePlayer(playerId, data) {
		this.store.set(playerId, JSON.parse(JSON.stringify(data)));
	}

	async loadPlayer(playerId) {
		const entry = this.store.get(playerId);
		return entry !== undefined ? JSON.parse(JSON.stringify(entry)) : null;
	}

	async saveSettings(accountId, data) {
		this.settingsStore.set(accountId, JSON.parse(JSON.stringify(data)));
	}

	async loadSettings(accountId) {
		const entry = this.settingsStore.get(accountId);
		return entry !== undefined ? JSON.parse(JSON.stringify(entry)) : null;
	}

	async loadAllUsers() {
		return Array.from(this.usersStore.values()).map((record) =>
			JSON.parse(JSON.stringify(record))
		);
	}

	async loadUser(username) {
		assertSafeStorageKey(username, 'username');
		const entry = this.usersStore.get(username);
		return entry !== undefined ? JSON.parse(JSON.stringify(entry)) : null;
	}

	async loadUserByAccountId(accountId) {
		assertSafeStorageKey(accountId, 'accountId');
		for (const record of this.usersStore.values()) {
			if (record.accountId === accountId) {
				return JSON.parse(JSON.stringify(record));
			}
		}
		return null;
	}

	async saveUser(record) {
		if (!record || typeof record !== 'object') {
			throw new Error('saveUser requires a user record object');
		}
		assertSafeStorageKey(record.username, 'username');
		assertSafeStorageKey(record.accountId, 'accountId');
		this.usersStore.set(record.username, JSON.parse(JSON.stringify(record)));
	}

	async deleteUser(username) {
		assertSafeStorageKey(username, 'username');
		this.usersStore.delete(username);
	}

	async close() {
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

	async savePlayer(playerId, data) {
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

	async loadPlayer(playerId) {
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

	async saveSettings(accountId, data) {
		assertSafePlayerId(accountId);
		const settingsDir = path.join(this.basePath, 'settings');
		fs.mkdirSync(settingsDir, { recursive: true });
		const json = JSON.stringify(data, null, 2);
		const finalPath = path.join(settingsDir, `${accountId}.json`);
		const tmpPath = `${finalPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

		try {
			fs.writeFileSync(tmpPath, json, 'utf-8');
			fs.renameSync(tmpPath, finalPath);
		} catch (err) {
			try { fs.unlinkSync(tmpPath); } catch (_) {}
			throw err;
		}
	}

	async loadSettings(accountId) {
		assertSafePlayerId(accountId);
		const settingsDir = path.join(this.basePath, 'settings');
		const filePath = path.join(settingsDir, `${accountId}.json`);
		try {
			const raw = fs.readFileSync(filePath, 'utf-8');
			return JSON.parse(raw);
		} catch (err) {
			if (err.code === 'ENOENT') return null;
			throw err;
		}
	}

	async loadAllUsers() {
		return readUsersArray(usersFilePath(this.basePath)).map((record) =>
			JSON.parse(JSON.stringify(record))
		);
	}

	async loadUser(username) {
		assertSafeStorageKey(username, 'username');
		const records = readUsersArray(usersFilePath(this.basePath));
		const found = records.find((record) => record.username === username);
		return found !== undefined ? JSON.parse(JSON.stringify(found)) : null;
	}

	async loadUserByAccountId(accountId) {
		assertSafeStorageKey(accountId, 'accountId');
		const records = readUsersArray(usersFilePath(this.basePath));
		const found = records.find((record) => record.accountId === accountId);
		return found !== undefined ? JSON.parse(JSON.stringify(found)) : null;
	}

	async saveUser(record) {
		if (!record || typeof record !== 'object') {
			throw new Error('saveUser requires a user record object');
		}
		assertSafeStorageKey(record.username, 'username');
		assertSafeStorageKey(record.accountId, 'accountId');
		const copy = JSON.parse(JSON.stringify(record));
		const filePath = usersFilePath(this.basePath);
		const records = readUsersArray(filePath);
		const index = records.findIndex((entry) => entry.username === copy.username);
		if (index >= 0) {
			records[index] = copy;
		} else {
			records.push(copy);
		}
		writeUsersArrayAtomic(filePath, records);
	}

	async deleteUser(username) {
		assertSafeStorageKey(username, 'username');
		const filePath = usersFilePath(this.basePath);
		const records = readUsersArray(filePath);
		const filtered = records.filter((entry) => entry.username !== username);
		if (filtered.length === records.length) {
			return;
		}
		writeUsersArrayAtomic(filePath, filtered);
	}

	async close() {
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
	}

	/**
	 * Create a provider and await schema bootstrap (production startup path).
	 * @param {string} databaseUrl
	 * @param {{ skipSchemaEnsure?: boolean }} [options]
	 */
	static async create(databaseUrl, options = {}) {
		const provider = new PostgresProvider(databaseUrl, { ...options, skipSchemaEnsure: true });
		if (!options.skipSchemaEnsure) {
			await ensurePlayersSchema(provider.pool);
			await ensureSettingsSchema(provider.pool);
			await ensureUsersSchema(provider.pool);
		}
		return provider;
	}

	async savePlayer(playerId, data) {
		assertSafePlayerId(playerId);
		const copy = JSON.parse(JSON.stringify(data));
		await this.pool.query(
			`INSERT INTO players (player_id, data) VALUES ($1, $2::jsonb)
			 ON CONFLICT (player_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
			[playerId, JSON.stringify(copy)]
		);
	}

	async loadPlayer(playerId) {
		assertSafePlayerId(playerId);
		const { rows } = await this.pool.query(
			`SELECT data FROM players WHERE player_id = $1`,
			[playerId]
		);
		if (rows.length === 0) return null;
		return JSON.parse(JSON.stringify(rows[0].data));
	}

	async saveSettings(accountId, data) {
		assertSafePlayerId(accountId);
		const copy = JSON.parse(JSON.stringify(data));
		await this.pool.query(
			`INSERT INTO settings (account_id, data) VALUES ($1, $2::jsonb)
			 ON CONFLICT (account_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
			[accountId, JSON.stringify(copy)]
		);
	}

	async loadSettings(accountId) {
		assertSafePlayerId(accountId);
		const { rows } = await this.pool.query(
			`SELECT data FROM settings WHERE account_id = $1`,
			[accountId]
		);
		if (rows.length === 0) return null;
		return JSON.parse(JSON.stringify(rows[0].data));
	}

	async loadAllUsers() {
		const { rows } = await this.pool.query(`SELECT data FROM users`);
		return rows.map((row) => JSON.parse(JSON.stringify(row.data)));
	}

	async loadUser(username) {
		assertSafeStorageKey(username, 'username');
		const { rows } = await this.pool.query(
			`SELECT data FROM users WHERE username = $1`,
			[username]
		);
		if (rows.length === 0) return null;
		return JSON.parse(JSON.stringify(rows[0].data));
	}

	async loadUserByAccountId(accountId) {
		assertSafeStorageKey(accountId, 'accountId');
		const { rows } = await this.pool.query(
			`SELECT data FROM users WHERE account_id = $1`,
			[accountId]
		);
		if (rows.length === 0) return null;
		return JSON.parse(JSON.stringify(rows[0].data));
	}

	async saveUser(record) {
		if (!record || typeof record !== 'object') {
			throw new Error('saveUser requires a user record object');
		}
		assertSafeStorageKey(record.username, 'username');
		assertSafeStorageKey(record.accountId, 'accountId');
		const copy = JSON.parse(JSON.stringify(record));
		await this.pool.query(
			`INSERT INTO users (username, account_id, data) VALUES ($1, $2, $3::jsonb)
			 ON CONFLICT (username) DO UPDATE
			 SET account_id = EXCLUDED.account_id, data = EXCLUDED.data, updated_at = NOW()`,
			[copy.username, copy.accountId, JSON.stringify(copy)]
		);
	}

	async deleteUser(username) {
		assertSafeStorageKey(username, 'username');
		await this.pool.query(`DELETE FROM users WHERE username = $1`, [username]);
	}

	async close() {
		if (!this._ownsPool || this._closed) return;
		this._closed = true;
		try {
			await this.pool.end();
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
	assertSafeStorageKey,
	SAFE_PLAYER_ID_REGEX,
};
