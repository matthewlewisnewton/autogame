// Abstract persistence interface — concrete backends extend this class.

export class StorageProvider {
	savePlayer(playerId, data) {
		throw new Error('Not implemented');
	}

	loadPlayer(playerId) {
		throw new Error('Not implemented');
	}

	close() {
		throw new Error('Not implemented');
	}
}
