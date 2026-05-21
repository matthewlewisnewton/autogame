// Concrete storage providers — InMemory (dev/test) and File (production).

const { StorageProvider } = require('./storage');
const fs = require('fs');
const path = require('path');

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
		const json = JSON.stringify(data, null, 2);
		const finalPath = path.join(this.basePath, `${playerId}.json`);
		const tmpPath = finalPath + '.tmp';

		fs.writeFileSync(tmpPath, json, 'utf-8');
		fs.renameSync(tmpPath, finalPath);
	}

	loadPlayer(playerId) {
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

module.exports = { InMemoryProvider, FileProvider };
