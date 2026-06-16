// Abstract persistence interface — concrete backends extend this class.

class StorageProvider {
	savePlayer(playerId, data) {
		throw new Error('Not implemented');
	}

	loadPlayer(playerId) {
		throw new Error('Not implemented');
	}

	saveSettings(accountId, data) {
		throw new Error('Not implemented');
	}

	loadSettings(accountId) {
		throw new Error('Not implemented');
	}

	close() {
		throw new Error('Not implemented');
	}
}

module.exports = { StorageProvider };
