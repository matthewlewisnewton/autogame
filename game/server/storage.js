// Abstract persistence interface — concrete backends extend this class.

class StorageProvider {
	async savePlayer(playerId, data) {
		throw new Error('Not implemented');
	}

	async loadPlayer(playerId) {
		throw new Error('Not implemented');
	}

	async saveSettings(accountId, data) {
		throw new Error('Not implemented');
	}

	async loadSettings(accountId) {
		throw new Error('Not implemented');
	}

	async close() {
		throw new Error('Not implemented');
	}
}

module.exports = { StorageProvider };
