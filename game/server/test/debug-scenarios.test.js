import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
	testGameState,
} from './helpers.js';

describe('debugScenario — key-item-cooldown', () => {
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

	it('puts the player in playing phase with dodge_roll equipped and active cooldown', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'key-item-cooldown' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('key-item-cooldown');

		const state = testGameState();
		expect(state.gamePhase).toBe('playing');

		const player = playerForSocket(socket);
		expect(player.equippedKeyItemId).toBe('dodge_roll');
		expect(player.keyItemCooldownUntil).toBeGreaterThan(Date.now());
	});
});

describe('debugScenario — quest-objective-near-complete', () => {
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

	it('leaves a playing defeat_enemies run one low-HP grunt from victory', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'quest-objective-near-complete' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('quest-objective-near-complete');

		const state = testGameState();
		expect(state.gamePhase).toBe('playing');
		expect(state.run.status).toBe('playing');
		expect(state.run.objective.type).toBe('defeat_enemies');
		expect(state.run.objective.totalEnemies).toBe(1);
		expect(state.run.objective.defeatedEnemies).toBe(0);

		// Exactly one low-HP grunt remains, adjacent to the player.
		expect(state.enemies.length).toBe(1);
		const enemy = state.enemies[0];
		expect(enemy.type).toBe('grunt');
		expect(enemy.hp).toBeLessThan(enemy.maxHp);

		// Player is restored and keeps a usable hand to finish through real combat.
		const player = playerForSocket(socket);
		expect(player.hp).toBeGreaterThan(0);
		expect(player.hand.some((c) => c)).toBe(true);
	});
});

describe('debugScenario — warded-enemy', () => {
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

	it('spawns a warded grunt with shield beside a plain grunt', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'warded-enemy' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('warded-enemy');

		const state = testGameState();
		expect(state.gamePhase).toBe('playing');
		expect(state.enemies.length).toBe(2);

		const warded = state.enemies.find((e) => e.variant === 'warded');
		const plain = state.enemies.find((e) => !e.variant);
		expect(warded).toBeDefined();
		expect(warded.type).toBe('grunt');
		expect(warded.shieldHp).toBeGreaterThan(0);
		expect(warded.maxShieldHp).toBe(warded.shieldHp);
		expect(plain).toBeDefined();
		expect(plain.type).toBe('grunt');
	});
});
