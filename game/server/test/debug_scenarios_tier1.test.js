import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	lobbyStateForSocket,
	playerForSocket,
} from './helpers.js';
import {
	QUEST_DEFS,
	countScriptedEnemiesInQuest,
	countFinalAmbushEnemies,
} from '../quests.js';

function roomAt(layout, x, z) {
	return layout.rooms.find((r) => {
		const hw = r.width / 2;
		const hd = r.depth / 2;
		return x >= r.x - hw && x <= r.x + hw && z >= r.z - hd && z <= r.z + hd;
	});
}

describe('debugScenario — frost-crossing-frostmaw', () => {
	let baseUrl;
	let prevAllowDebug;

	beforeEach(async () => {
		prevAllowDebug = process.env.ALLOW_DEBUG_SCENARIOS;
		process.env.ALLOW_DEBUG_SCENARIOS = '1';
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
		if (prevAllowDebug === undefined) {
			delete process.env.ALLOW_DEBUG_SCENARIOS;
		} else {
			process.env.ALLOW_DEBUG_SCENARIOS = prevAllowDebug;
		}
	});

	it('lands in Rimecast encounter after dock and ice thrower waves are cleared', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'frost-crossing-frostmaw' });
		const debugResult = await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		expect(debugResult.ok).toBe(true);
		expect(debugResult.scenario).toBe('frost-crossing-frostmaw');

		const state = lobbyStateForSocket(socket);
		const player = playerForSocket(socket);
		const iceRoom = state.layout.rooms.find((room) => room.band === 'ice');

		const rimecasts = state.enemies.filter(
			(enemy) => enemy.displayName === 'Rimecast the Slow' && enemy.hp > 0,
		);
		expect(rimecasts).toHaveLength(1);

		const dockWave0 = state.enemies.filter(
			(enemy) => enemy.scriptedWave?.roomKey === 'room:0' && enemy.scriptedWave?.waveIndex === 0,
		);
		expect(dockWave0).toHaveLength(0);

		const iceWave0 = state.enemies.filter(
			(enemy) =>
				enemy.scriptedWave?.roomKey === 'band:ice' && enemy.scriptedWave?.waveIndex === 0,
		);
		expect(iceWave0).toHaveLength(0);

		expect(state.run.passageLocks.every((lock) => lock.locked === false)).toBe(true);

		const rimecast = rimecasts[0];
		const dist = Math.hypot(player.x - rimecast.x, player.z - rimecast.z);
		expect(dist).toBeGreaterThanOrEqual(2);
		expect(dist).toBeLessThanOrEqual(4.5);

		const playerRoom = roomAt(state.layout, player.x, player.z);
		expect(playerRoom?.band).toBe('ice');
		expect(iceRoom).toBeDefined();
	});
});

describe('debugScenario — crystal-rescue-extraction-phase', () => {
	let baseUrl;
	let prevAllowDebug;

	beforeEach(async () => {
		prevAllowDebug = process.env.ALLOW_DEBUG_SCENARIOS;
		process.env.ALLOW_DEBUG_SCENARIOS = '1';
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
		if (prevAllowDebug === undefined) {
			delete process.env.ALLOW_DEBUG_SCENARIOS;
		} else {
			process.env.ALLOW_DEBUG_SCENARIOS = prevAllowDebug;
		}
	});

	it('lands in post-ambush extraction with 9/9 enemy counters and no live hostiles', async () => {
		const { socket } = await connectClient(baseUrl);
		const questTier = QUEST_DEFS.crystal_rescue.tiers[1];
		const fullEnemyTotal = countScriptedEnemiesInQuest(questTier) + countFinalAmbushEnemies(questTier);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'crystal-rescue-extraction-phase' });
		const debugResult = await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		expect(debugResult.ok).toBe(true);
		expect(debugResult.scenario).toBe('crystal-rescue-extraction-phase');

		const state = lobbyStateForSocket(socket);
		const player = playerForSocket(socket);
		const objective = state.run.objective;

		expect(objective.totalEnemies).toBe(fullEnemyTotal);
		expect(objective.defeatedEnemies).toBe(fullEnemyTotal);
		expect(fullEnemyTotal).toBe(9);
		expect(objective.collectedItems).toBe(3);
		expect(state.run.finalAmbush).toEqual({ spawned: true, cleared: true, enemyIds: [] });
		expect(objective.extractionPhase).toBe(true);
		expect(objective.extractionReached).toBe(false);
		expect(objective.label).toBe(`${questTier.name}: return to the entry dock`);
		expect(state.enemies).toHaveLength(0);

		const startRoom = state.layout.rooms.find((room) => room.role === 'start');
		expect(startRoom).toBeDefined();
		const playerRoom = roomAt(state.layout, player.x, player.z);
		expect(playerRoom?.role).not.toBe('start');
	});
});
