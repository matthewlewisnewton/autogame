import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import {
	getQuest,
	getLayoutProfileForQuest,
	getLayoutGenerationOptions,
} from '../quests.js';
import { resolveVariantRollTier } from '../enemyVariants.js';
import { resetGameState, gameState } from '../index.js';
import { spawnEnemies, setGameState } from '../progression.js';
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
const TRAINING_CAVERNS_ID = 'training_caverns';
const TRAINING_CAVERNS_TIER_2 = 2;
const SPIRE_ASCENT_ID = 'spire_ascent';
const SPIRE_ASCENT_TIER_2 = 2;

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

	it('deploys arena_trials Tier 2 with rigid layout, tier-2 run metadata, and variant enemies', async () => {
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
		expect(state.run.objective.totalEnemies).toBe(tier2Quest.enemyCount);
		expect(getLayoutGenerationOptions(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2));
		expect(state.enemies.length).toBe(tier2Quest.enemyCount);
		expect(state.enemies.every((e) => e.variant !== undefined)).toBe(true);
		// Tier-2 open-plaza rolls use full variant chance (Tier 1 scales to 0).
		expect(resolveVariantRollTier(state.run.questTier, 0)).toBe(1);
	});

	it('Tier 2 variant rolls tag enemies under fixed seed 4242 (arena_trials_tier2 parity)', () => {
		const SEED = 4242;
		resetGameState();
		const layout = generateLayout(
			SEED,
			getLayoutProfileForQuest(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2),
			getLayoutGenerationOptions(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2),
		);
		gameState.selectedQuestId = ARENA_TRIALS_ID;
		gameState.selectedQuestTier = ARENA_TRIALS_TIER_2;
		gameState.layout = layout;
		gameState.layoutSeed = SEED;
		gameState.enemies = [];
		gameState.loot = [];
		gameState.run = { questTier: ARENA_TRIALS_TIER_2 };
		setGameState(gameState);
		spawnEnemies();
		expect(gameState.enemies.some((e) => e.variant)).toBe(true);
	});
});

describe('debugScenario — training-caverns-tier-2', () => {
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

	it('deploys training_caverns Tier 2 with rigid crowded layout, tier-2 run metadata, and variant enemies', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'training-caverns-tier-2' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('training-caverns-tier-2');

		const state = testGameState();
		const tier2Quest = getQuest(TRAINING_CAVERNS_ID, TRAINING_CAVERNS_TIER_2);

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(TRAINING_CAVERNS_ID);
		expect(state.selectedQuestTier).toBe(TRAINING_CAVERNS_TIER_2);
		expect(state.run.questId).toBe(TRAINING_CAVERNS_ID);
		expect(state.run.questTier).toBe(TRAINING_CAVERNS_TIER_2);
		expect(state.run.questName).toBe(tier2Quest.name);
		expect(state.run.objective.label).toContain(tier2Quest.name);
		expect(state.run.objective.totalEnemies).toBe(tier2Quest.enemyCount);
		expect(state.layout.profile).toBe('crowded');
		expect(getLayoutGenerationOptions(TRAINING_CAVERNS_ID, TRAINING_CAVERNS_TIER_2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(TRAINING_CAVERNS_ID, TRAINING_CAVERNS_TIER_2));
		expect(state.enemies.length).toBe(tier2Quest.enemyCount);
		expect(state.enemies.every((e) => e.variant !== undefined)).toBe(true);
		expect(resolveVariantRollTier(state.run.questTier, 0)).toBe(1);
	});

	it('Tier 2 variant rolls tag enemies under fixed seed 4242 (training_caverns_tier2 parity)', () => {
		const SEED = 4242;
		resetGameState();
		const layout = generateLayout(
			SEED,
			getLayoutProfileForQuest(TRAINING_CAVERNS_ID, TRAINING_CAVERNS_TIER_2),
			getLayoutGenerationOptions(TRAINING_CAVERNS_ID, TRAINING_CAVERNS_TIER_2),
		);
		gameState.selectedQuestId = TRAINING_CAVERNS_ID;
		gameState.selectedQuestTier = TRAINING_CAVERNS_TIER_2;
		gameState.layout = layout;
		gameState.layoutSeed = SEED;
		gameState.enemies = [];
		gameState.loot = [];
		gameState.run = { questTier: TRAINING_CAVERNS_TIER_2 };
		setGameState(gameState);
		spawnEnemies();
		expect(gameState.enemies.some((e) => e.variant)).toBe(true);
	});
});

describe('debugScenario — spire-ascent-tier-2', () => {
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

	it('deploys spire_ascent Tier 2 with rigid layout, tier-2 run metadata, and variant enemies', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'spire-ascent-tier-2' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('spire-ascent-tier-2');

		const state = testGameState();
		const tier2Quest = getQuest(SPIRE_ASCENT_ID, SPIRE_ASCENT_TIER_2);

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(SPIRE_ASCENT_ID);
		expect(state.selectedQuestTier).toBe(SPIRE_ASCENT_TIER_2);
		expect(state.run.questId).toBe(SPIRE_ASCENT_ID);
		expect(state.run.questTier).toBe(SPIRE_ASCENT_TIER_2);
		expect(state.run.questName).toBe(tier2Quest.name);
		expect(state.run.objective.label).toContain(tier2Quest.name);
		expect(state.run.objective.totalEnemies).toBe(tier2Quest.enemyCount);
		expect(state.layout.profile).toBe('spire-ascent');
		expect(getLayoutGenerationOptions(SPIRE_ASCENT_ID, SPIRE_ASCENT_TIER_2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(SPIRE_ASCENT_ID, SPIRE_ASCENT_TIER_2));
		expect(state.enemies.length).toBe(tier2Quest.enemyCount);
		expect(state.enemies.every((e) => e.variant !== undefined)).toBe(true);
		expect(resolveVariantRollTier(state.run.questTier, 0)).toBe(1);
	});

	it('Tier 2 variant rolls tag enemies under fixed seed 4242 (spire_ascent_tier2 parity)', () => {
		const SEED = 4242;
		resetGameState();
		const layout = generateLayout(
			SEED,
			getLayoutProfileForQuest(SPIRE_ASCENT_ID, SPIRE_ASCENT_TIER_2),
			getLayoutGenerationOptions(SPIRE_ASCENT_ID, SPIRE_ASCENT_TIER_2),
		);
		gameState.selectedQuestId = SPIRE_ASCENT_ID;
		gameState.selectedQuestTier = SPIRE_ASCENT_TIER_2;
		gameState.layout = layout;
		gameState.layoutSeed = SEED;
		gameState.enemies = [];
		gameState.loot = [];
		gameState.run = { questTier: SPIRE_ASCENT_TIER_2 };
		setGameState(gameState);
		spawnEnemies();
		expect(gameState.enemies.some((e) => e.variant)).toBe(true);
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
