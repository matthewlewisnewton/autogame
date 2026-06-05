import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { questLayoutSeed } from '../dungeon.js';
import {
	getQuest,
	getLayoutGenerationOptions,
} from '../quests.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
	testGameState,
} from './helpers.js';

const ARENA_TRIALS_ID = 'arena_trials';
const ARENA_TRIALS_TIER_2 = 2;

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

describe('debugScenario — suspended-run-hub', () => {
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

	it('drops the squad into the hub lobby on top of a suspended checkpoint', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'suspended-run-hub' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('suspended-run-hub');

		const state = testGameState();
		// Suspended run: back in the lobby with a checkpoint that drives the
		// distinct Resume affordance (and the suspended-run banner) in the hub.
		expect(state.gamePhase).toBe('lobby');
		expect(state.suspendedCheckpoint).toBeTruthy();
		expect(state.suspendedCheckpoint.run.status).toBe('playing');

		// The checkpoint carries non-default spent/damaged values to resume into.
		const playerId = socket._playerId;
		const saved = state.suspendedCheckpoint.playerStates[playerId];
		expect(saved.magicStones).toBeLessThan(49);
		const weapon = saved.hand.find((c) => c && c.type === 'weapon');
		expect(weapon).toBeTruthy();
		expect(weapon.remainingCharges).toBeLessThan(weapon.charges);
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

describe('debugScenario — arena-trials-tier-2', () => {
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

	it('deploys arena_trials Tier 2 stage-boss encounter with rigid layout and active run.encounter', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-tier-2' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('arena-trials-tier-2');

		const state = testGameState();
		const tier2Quest = getQuest(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2);

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(ARENA_TRIALS_ID);
		expect(state.selectedQuestTier).toBe(ARENA_TRIALS_TIER_2);
		expect(state.run.questId).toBe(ARENA_TRIALS_ID);
		expect(state.run.questTier).toBe(ARENA_TRIALS_TIER_2);
		expect(state.run.questName).toBe(tier2Quest.name);
		expect(state.run.objective.label).toContain(tier2Quest.name);
		expect(state.run.objective.totalEnemies).toBe(1);
		expect(state.run.encounter).toMatchObject({
			status: 'active',
			bossType: 'miniboss',
			trigger: 'deploy',
			rewardCurrencyBonus: 5,
		});
		expect(getLayoutGenerationOptions(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2));
		expect(state.enemies.length).toBe(1);
		expect(state.enemies[0].type).toBe('miniboss');
		expect(state.enemies[0].isStageBoss).toBe(true);
		expect(state.enemies[0].id).toBe(state.run.encounter.bossEnemyId);
	});
});

describe('debugScenario — variant-frenzied', () => {
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

	it('spawns a frenzied grunt beside a plain grunt', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'variant-frenzied' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('variant-frenzied');

		const state = testGameState();
		expect(state.gamePhase).toBe('playing');
		expect(state.enemies.length).toBe(2);

		const frenzied = state.enemies.find((e) => e.variant === 'frenzied');
		const plain = state.enemies.find((e) => !e.variant);
		expect(frenzied).toBeDefined();
		expect(frenzied.type).toBe('grunt');
		expect(plain).toBeDefined();
		expect(plain.type).toBe('grunt');
	});
});
