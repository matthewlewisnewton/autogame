// Concrete storage providers — InMemory (dev/test) and File (production).

const { StorageProvider } = require('./storage');
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

module.exports = { InMemoryProvider, FileProvider, assertSafePlayerId, SAFE_PLAYER_ID_REGEX };
