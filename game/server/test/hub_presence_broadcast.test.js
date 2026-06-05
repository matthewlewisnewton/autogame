import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HUB_LAYOUT } from '../index.js';
import { hubSpawnPosition } from '../simulation.js';
import {
	startTestServer,
	closeServer,
	connectTwoClients,
	waitForEvent,
} from './helpers.js';

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('hub presence broadcast', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	it('lobbyJoined includes hubPresence snapshot with connected players', async () => {
		const hubSpawn = hubSpawnPosition(HUB_LAYOUT);
		const { initA, initB } = await connectTwoClients(baseUrl, 'hub-broadcast-a', 'hub-broadcast-b');

		expect(initA.hubPresence).toMatchObject({
			schemaVersion: 1,
			entries: {},
		});
		expect(initA.hubPresence.entries[initA.playerId]).toMatchObject({
			id: initA.playerId,
			x: hubSpawn.x,
			z: hubSpawn.z,
			connected: true,
		});

		expect(initB.hubPresence).toMatchObject({ schemaVersion: 1 });
		expect(Object.keys(initB.hubPresence.entries)).toHaveLength(2);
		expect(initB.hubPresence.entries[initA.playerId]).toBeDefined();
		expect(initB.hubPresence.entries[initB.playerId]).toBeDefined();
	});

	it('move in lobby phase broadcasts hubPresenceUpdate to other members', async () => {
		const hubSpawn = hubSpawnPosition(HUB_LAYOUT);
		const { socketA, socketB, initA } = await connectTwoClients(
			baseUrl,
			'hub-move-a',
			'hub-move-b',
		);

		const updatePromise = waitForEvent(socketB, 'hubPresenceUpdate');
		socketA.emit('move', { dx: 1, dz: 0, rotation: 0, sequence: 1 });
		await sleep(120);

		const update = await updatePromise;
		expect(update.lobbyId).toBe(initA.lobbyId);
		expect(update.presence.entries[initA.playerId]).toBeDefined();
		expect(update.presence.entries[initA.playerId].x).toBeGreaterThan(hubSpawn.x);
		expect(update.presence.entries[initA.playerId].z).toBeCloseTo(hubSpawn.z, 1);
	});

	it('leave emits hubPresenceUpdate with removedPlayerIds', async () => {
		const { socketA, socketB, initA, initB } = await connectTwoClients(
			baseUrl,
			'hub-leave-a',
			'hub-leave-b',
		);

		const leaveUpdatePromise = waitForEvent(socketB, 'hubPresenceUpdate');
		socketA.emit('leaveLobby');
		const update = await leaveUpdatePromise;

		expect(update.removedPlayerIds).toEqual([initA.playerId]);
		expect(update.presence.entries[initA.playerId]).toBeUndefined();
		expect(update.presence.entries[initB.playerId]).toBeDefined();
	});
});
