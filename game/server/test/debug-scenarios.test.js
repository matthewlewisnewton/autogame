import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sim = require('../simulation.js');
const { setGameState: setProgressionGameState } = require('../progression.js');
const { _timeouts } = require('../index.js');
import { generateLayout, questLayoutSeed, sampleFloorY, sampleFloorSurface, resolveFloorY } from '../dungeon.js';
import {
	getQuest,
	getEnemyPool,
	getLayoutProfileForQuest,
	getLayoutGenerationOptions,
} from '../quests.js';
import { resolveVariantRollTier } from '../enemyVariants.js';
import {
	ENCOUNTER_PHASES,
	ENCOUNTER_TRIGGER_RADIUS,
	clearNonBossEnemies,
	resolveEncounterAnchor,
} from '../encounters.js';
import { resetGameState, gameState, runGameLoopTick, applyBurning, updateBurning } from '../index.js';
import { checkAllReady, setGameState as setProgressionGameStateForReady } from '../progression.js';
import { APPEARANCE_CHANGE_COST, MAX_MAGIC_STONES } from '../config.js';
import { spawnEnemies, setGameState } from '../progression.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	waitForStateUpdateWithRun,
	waitForStateUpdateWithPlayerCurrency,
	lobbyStateForSocket,
	playerForSocket,
	testGameState,
} from './helpers.js';

const ARENA_TRIALS_ID = 'arena_trials';
const ARENA_TRIALS_TIER_2 = 2;
const TRAINING_CAVERNS_ID = 'training_caverns';
const TRAINING_CAVERNS_TIER_2 = 2;
const CRYSTAL_RESCUE_ID = 'crystal_rescue';
const CRYSTAL_RESCUE_TIER_2 = 2;
const SPIRE_ASCENT_ID = 'spire_ascent';
const SPIRE_ASCENT_TIER_2 = 2;
const CANYON_DESCENT_ID = 'canyon_descent';
const CANYON_DESCENT_TIER_2 = 2;
const EMBER_DESCENT_ID = 'ember_descent';
const EMBER_DESCENT_TIER_1 = 1;
const FROST_CROSSING_ID = 'frost_crossing';
const FROST_CROSSING_TIER_1 = 1;

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

	it('drops the squad into the hub lobby after telepipe extract with durable vitals', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'suspended-run-hub' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('suspended-run-hub');

		const state = testGameState();
		expect(state.gamePhase).toBe('lobby');
		expect(state.run).toBeUndefined();
		expect(state.enemies).toHaveLength(0);
		expect(state.telepipe).toBeNull();

		const playerId = socket._playerId;
		expect(state.players[playerId].hp).toBe(42);
		expect(state.players[playerId].magicStones).toBe(15);
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

	it('deploys arena_trials Tier 2 stage-boss run with encounter and rigid layout', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForStateUpdateWithRun(socket);
		socket.emit('debugScenario', { name: 'arena-trials-tier-2' });
		const result = await debugResultPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('arena-trials-tier-2');

		const state = lobbyStateForSocket(socket);
		const tier2Quest = getQuest(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2);
		const addCount = tier2Quest.encounter.addCount;

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(ARENA_TRIALS_ID);
		expect(state.selectedQuestTier).toBe(ARENA_TRIALS_TIER_2);
		expect(stateUpdate.run.questId).toBe(ARENA_TRIALS_ID);
		expect(stateUpdate.run.questTier).toBe(ARENA_TRIALS_TIER_2);
		expect(stateUpdate.run.questName).toBe(tier2Quest.name);
		expect(getQuest(ARENA_TRIALS_ID, state.selectedQuestTier).encounter?.addCount).toBe(
			addCount,
		);
		expect(stateUpdate.run.objective.type).toBe('stage_boss');
		expect(stateUpdate.run.objective.label).toContain(tier2Quest.name);
		expect(stateUpdate.run.encounter).toBeTruthy();
		expect(stateUpdate.run.encounter.bossEnemyId).toBeTruthy();
		expect(getLayoutGenerationOptions(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2));
		expect(stateUpdate.enemies.length).toBe(1 + addCount);
		expect(
			stateUpdate.enemies.some((e) => e.id === stateUpdate.run.encounter.bossEnemyId),
		).toBe(true);
		expect(stateUpdate.enemies.every((e) => e.variant !== undefined)).toBe(true);
		// Tier-2 open-plaza rolls use full variant chance (Tier 1 scales to 0).
		expect(resolveVariantRollTier(stateUpdate.run.questTier, 0)).toBe(1);
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
		gameState.gamePhase = 'playing';
		gameState.run = { questTier: ARENA_TRIALS_TIER_2 };
		setGameState(gameState);
		spawnEnemies();
		expect(gameState.enemies.some((e) => e.variant)).toBe(true);
		expect(gameState.enemies.filter((e) => e.type === 'arena_champion')).toHaveLength(1);
	});
});

describe('debugScenario — arena-trials harness combat shortcuts', () => {
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

	it('repositions beside live adds after arena-trials-tier-2 deploy', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-tier-2' });
		const tier2Result = await tier2Promise;
		expect(tier2Result.ok).toBe(true);

		const state = testGameState();
		const player = playerForSocket(socket);
		const addsBefore = state.enemies.filter(
			(e) => e.hp > 0 && e.type !== 'arena_champion' && (e.type === 'grunt' || e.type === 'skirmisher'),
		);
		expect(addsBefore.length).toBeGreaterThan(0);

		const nearAddsPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'arena-trials-near-adds' });
		const nearAddsResult = await nearAddsPromise;
		await stateUpdatePromise;

		expect(nearAddsResult.ok).toBe(true);
		expect(nearAddsResult.scenario).toBe('arena-trials-near-adds');
		expect(player.hand[0]?.type).toBe('weapon');
		expect(
			state.enemies.filter(
				(e) => e.hp > 0 && e.type !== 'arena_champion' && (e.type === 'grunt' || e.type === 'skirmisher'),
			).every((e) => e.hp === 1 && !e.shieldHp),
		).toBe(true);

		let nearest = addsBefore[0];
		let bestDist = Infinity;
		for (const add of addsBefore) {
			const dist = Math.hypot(add.x - player.x, add.z - player.z);
			if (dist < bestDist) {
				bestDist = dist;
				nearest = add;
			}
		}
		expect(bestDist).toBeGreaterThanOrEqual(2);
		expect(bestDist).toBeLessThanOrEqual(5);
	});

	it('places player outside dormant arena_champion trigger after adds cleared', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-tier-2' });
		await tier2Promise;

		const state = testGameState();
		const bossId = state.run.encounter.bossEnemyId;
		for (const enemy of state.enemies) {
			if (enemy.id !== bossId) enemy.hp = 0;
		}
		state.enemies = state.enemies.filter((e) => e.hp > 0);

		const approachPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-boss-approach' });
		const approachResult = await approachPromise;

		expect(approachResult.ok).toBe(true);
		expect(approachResult.scenario).toBe('arena-trials-boss-approach');

		const player = playerForSocket(socket);
		const boss = state.enemies.find((e) => e.id === bossId);
		const dist = Math.hypot(boss.x - player.x, boss.z - player.z);
		expect(dist).toBeGreaterThan(ENCOUNTER_TRIGGER_RADIUS);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

		for (let i = 0; i < 30; i++) {
			runGameLoopTick();
		}
		const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');
		const distFromAnchor = Math.hypot(dais.x - player.x, dais.z - player.z);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
		expect(distFromAnchor).toBeGreaterThan(ENCOUNTER_TRIGGER_RADIUS);
	});

	it('positions arena_champion at 1 HP beside the player in playing phase', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-tier-2' });
		await tier2Promise;

		const lowHpPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'arena-trials-boss-low-hp' });
		const lowHpResult = await lowHpPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(lowHpResult.ok).toBe(true);
		expect(lowHpResult.scenario).toBe('arena-trials-boss-low-hp');

		const state = testGameState();
		const bossId = state.run.encounter.bossEnemyId;
		const boss = state.enemies.find((e) => e.id === bossId);
		expect(boss?.type).toBe('arena_champion');
		expect(boss?.hp).toBe(1);

		const player = playerForSocket(socket);
		const dist = Math.hypot(boss.x - player.x, boss.z - player.z);
		expect(dist).toBeGreaterThanOrEqual(2);
		expect(dist).toBeLessThanOrEqual(5.5);

		const bossUpdate = stateUpdate.enemies.find((e) => e.id === bossId);
		expect(bossUpdate?.hp).toBe(1);
		expect(bossUpdate?.type).toBe('arena_champion');
	});
});

describe('debugScenario — stage-boss-dormant', () => {
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

	it('deploys arena_trials Tier 2 dormant stage-boss encounter via normal run path', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForStateUpdateWithRun(socket);
		socket.emit('debugScenario', { name: 'stage-boss-dormant' });
		const result = await debugResultPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('stage-boss-dormant');

		const state = lobbyStateForSocket(socket);
		const player = playerForSocket(socket);
		const tier2Quest = getQuest(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2);
		const addCount = tier2Quest.encounter.addCount;

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(ARENA_TRIALS_ID);
		expect(state.selectedQuestTier).toBe(ARENA_TRIALS_TIER_2);
		expect(stateUpdate.run.questTier).toBe(ARENA_TRIALS_TIER_2);
		expect(stateUpdate.run.questName).toBe(tier2Quest.name);
		expect(stateUpdate.run.objective.type).toBe('stage_boss');
		expect(stateUpdate.run.objective.addCount).toBe(addCount);
		expect(stateUpdate.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
		expect(stateUpdate.run.encounter.locked).toBe(false);
		expect(stateUpdate.run.encounter.bossEnemyId).toBeTruthy();
		expect(stateUpdate.enemies.length).toBe(1 + addCount);
		expect(stateUpdate.enemies.every((e) => e.hp > 0)).toBe(true);
		expect(
			stateUpdate.enemies.some((e) => e.id === stateUpdate.run.encounter.bossEnemyId),
		).toBe(true);

		const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');
		expect(dais).toBeTruthy();
		const dist = Math.hypot(player.x - dais.x, player.z - dais.z);
		expect(dist).toBeGreaterThan(ENCOUNTER_TRIGGER_RADIUS);
	});
});

describe('debugScenario — stage-boss-active', () => {
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

	it('activates arena_trials Tier 2 stage-boss encounter with boss at 1 HP', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForStateUpdateWithRun(socket);
		socket.emit('debugScenario', { name: 'stage-boss-active' });
		const result = await debugResultPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('stage-boss-active');

		const state = lobbyStateForSocket(socket);
		const tier2Quest = getQuest(ARENA_TRIALS_ID, ARENA_TRIALS_TIER_2);
		const addCount = tier2Quest.encounter.addCount;
		const bossId = stateUpdate.run.encounter.bossEnemyId;

		expect(state.selectedQuestTier).toBe(ARENA_TRIALS_TIER_2);
		expect(stateUpdate.run.questName).toBe(tier2Quest.name);
		expect(stateUpdate.run.objective.type).toBe('stage_boss');
		expect(stateUpdate.run.objective.addCount).toBe(addCount);
		expect(stateUpdate.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
		expect(stateUpdate.run.encounter.locked).toBe(true);
		expect(stateUpdate.enemies.length).toBe(1);
		expect(stateUpdate.enemies[0].id).toBe(bossId);
		expect(stateUpdate.enemies[0].hp).toBe(1);
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

	it('deploys training_caverns Tier 2 stage-boss run with encounter and rigid crowded layout', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForStateUpdateWithRun(socket);
		socket.emit('debugScenario', { name: 'training-caverns-tier-2' });
		const result = await debugResultPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('training-caverns-tier-2');

		const state = testGameState();
		const tier2Quest = getQuest(TRAINING_CAVERNS_ID, TRAINING_CAVERNS_TIER_2);
		const addCount = tier2Quest.encounter.addCount;

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(TRAINING_CAVERNS_ID);
		expect(state.selectedQuestTier).toBe(TRAINING_CAVERNS_TIER_2);
		expect(stateUpdate.run.questId).toBe(TRAINING_CAVERNS_ID);
		expect(stateUpdate.run.questTier).toBe(TRAINING_CAVERNS_TIER_2);
		expect(stateUpdate.run.questName).toBe(tier2Quest.name);
		expect(getQuest(TRAINING_CAVERNS_ID, state.selectedQuestTier).encounter?.bossType).toBe(
			'annex_overseer',
		);
		expect(stateUpdate.run.objective.type).toBe('stage_boss');
		expect(stateUpdate.run.objective.label).toContain(tier2Quest.name);
		expect(stateUpdate.run.encounter).toBeTruthy();
		expect(stateUpdate.run.encounter.bossEnemyId).toBeTruthy();
		expect(state.layout.profile).toBe('crowded');
		expect(getLayoutGenerationOptions(TRAINING_CAVERNS_ID, TRAINING_CAVERNS_TIER_2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(TRAINING_CAVERNS_ID, TRAINING_CAVERNS_TIER_2));
		expect(state.layout.landmarks.some((lm) => lm.type === 'vault_dais')).toBe(true);
		expect(stateUpdate.enemies.length).toBe(1 + addCount);
		expect(
			stateUpdate.enemies.some((e) => e.id === stateUpdate.run.encounter.bossEnemyId),
		).toBe(true);
		expect(
			stateUpdate.enemies.some((e) => e.type === 'annex_overseer'),
		).toBe(true);
		expect(stateUpdate.enemies.every((e) => e.variant !== undefined)).toBe(true);
		expect(resolveVariantRollTier(stateUpdate.run.questTier, 0)).toBe(1);
	});

	it('repositions beside live adds after training-caverns-tier-2 deploy', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'training-caverns-tier-2' });
		const tier2Result = await tier2Promise;
		expect(tier2Result.ok).toBe(true);

		const state = testGameState();
		const player = playerForSocket(socket);
		const addsBefore = state.enemies.filter(
			(e) => e.hp > 0 && e.type !== 'annex_overseer' && (e.type === 'grunt' || e.type === 'skirmisher'),
		);
		expect(addsBefore.length).toBeGreaterThan(0);

		const nearAddsPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'training-caverns-near-adds' });
		const nearAddsResult = await nearAddsPromise;
		await stateUpdatePromise;

		expect(nearAddsResult.ok).toBe(true);
		expect(nearAddsResult.scenario).toBe('training-caverns-near-adds');

		expect(player.hand[0]?.type).toBe('weapon');
		expect(player.hand[0]?.remainingCharges).toBeGreaterThan(0);
		expect(
			state.enemies.filter(
				(e) => e.hp > 0 && e.type !== 'annex_overseer' && (e.type === 'grunt' || e.type === 'skirmisher'),
			).every((e) => e.hp === 1 && !e.shieldHp),
		).toBe(true);

		let nearest = addsBefore[0];
		let bestDist = Infinity;
		for (const add of addsBefore) {
			const dist = Math.hypot(add.x - player.x, add.z - player.z);
			if (dist < bestDist) {
				bestDist = dist;
				nearest = add;
			}
		}
		expect(bestDist).toBeGreaterThanOrEqual(2);
		expect(bestDist).toBeLessThanOrEqual(5);
	});

	it('places player outside dormant boss trigger after adds cleared', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'training-caverns-tier-2' });
		await tier2Promise;

		const state = testGameState();
		const bossId = state.run.encounter.bossEnemyId;
		for (const enemy of state.enemies) {
			if (enemy.id !== bossId) enemy.hp = 0;
		}
		state.enemies = state.enemies.filter((e) => e.hp > 0);

		const approachPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'training-caverns-boss-approach' });
		const approachResult = await approachPromise;

		expect(approachResult.ok).toBe(true);
		expect(approachResult.scenario).toBe('training-caverns-boss-approach');

		const player = playerForSocket(socket);
		const boss = state.enemies.find((e) => e.id === bossId);
		const dist = Math.hypot(boss.x - player.x, boss.z - player.z);
		expect(dist).toBeGreaterThan(ENCOUNTER_TRIGGER_RADIUS);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

		for (let i = 0; i < 30; i++) {
			runGameLoopTick();
		}
		const anchor = resolveEncounterAnchor(state.run, state);
		const distFromAnchor = Math.hypot(anchor.x - player.x, anchor.z - player.z);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
		expect(distFromAnchor).toBeGreaterThan(ENCOUNTER_TRIGGER_RADIUS);
	});

	it('positions annex_overseer at 1 HP beside the player in playing phase', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'training-caverns-tier-2' });
		await tier2Promise;

		const lowHpPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'training-caverns-boss-low-hp' });
		const lowHpResult = await lowHpPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(lowHpResult.ok).toBe(true);
		expect(lowHpResult.scenario).toBe('training-caverns-boss-low-hp');

		const state = testGameState();
		expect(state.gamePhase).toBe('playing');

		const bossId = state.run.encounter.bossEnemyId;
		const boss = state.enemies.find((e) => e.id === bossId);
		expect(boss).toBeTruthy();
		expect(boss.type).toBe('annex_overseer');
		expect(boss.hp).toBe(1);

		const player = playerForSocket(socket);
		const dist = Math.hypot(boss.x - player.x, boss.z - player.z);
		expect(dist).toBeGreaterThanOrEqual(2);
		expect(dist).toBeLessThanOrEqual(5.5);

		const overseerUpdate = stateUpdate.enemies.find((e) => e.id === bossId);
		expect(overseerUpdate?.hp).toBe(1);
		expect(overseerUpdate?.type).toBe('annex_overseer');
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

describe('debugScenario — crystal-rescue-tier-2', () => {
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

	it('deploys crystal_rescue Tier 2 with rigid open layout, collect_items run metadata, and variant enemies', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'crystal-rescue-tier-2' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('crystal-rescue-tier-2');

		const state = testGameState();
		const tier2Quest = getQuest(CRYSTAL_RESCUE_ID, CRYSTAL_RESCUE_TIER_2);

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(CRYSTAL_RESCUE_ID);
		expect(state.selectedQuestTier).toBe(CRYSTAL_RESCUE_TIER_2);
		expect(state.run.questId).toBe(CRYSTAL_RESCUE_ID);
		expect(state.run.questTier).toBe(CRYSTAL_RESCUE_TIER_2);
		expect(state.run.questName).toBe(tier2Quest.name);
		expect(state.run.objective.type).toBe('collect_items');
		expect(state.run.objective.label).toContain(tier2Quest.name);
		expect(state.run.objective.totalItems).toBe(tier2Quest.itemCount);
		expect(state.layout.profile).toBe('open');
		expect(getLayoutGenerationOptions(CRYSTAL_RESCUE_ID, CRYSTAL_RESCUE_TIER_2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(CRYSTAL_RESCUE_ID, CRYSTAL_RESCUE_TIER_2));
		expect(state.enemies.length).toBe(tier2Quest.enemyCount);
		expect(state.loot.filter((l) => l.kind === 'crystal').length).toBe(tier2Quest.itemCount);
		expect(state.enemies.every((e) => e.variant !== undefined)).toBe(true);
		expect(resolveVariantRollTier(state.run.questTier, 0)).toBe(1);
	});

	it('Tier 2 variant rolls tag enemies under fixed seed 4242 (crystal_rescue_tier2 parity)', () => {
		const SEED = 4242;
		resetGameState();
		const layout = generateLayout(
			SEED,
			getLayoutProfileForQuest(CRYSTAL_RESCUE_ID, CRYSTAL_RESCUE_TIER_2),
			getLayoutGenerationOptions(CRYSTAL_RESCUE_ID, CRYSTAL_RESCUE_TIER_2),
		);
		gameState.selectedQuestId = CRYSTAL_RESCUE_ID;
		gameState.selectedQuestTier = CRYSTAL_RESCUE_TIER_2;
		gameState.layout = layout;
		gameState.layoutSeed = SEED;
		gameState.enemies = [];
		gameState.loot = [];
		gameState.run = { questTier: CRYSTAL_RESCUE_TIER_2 };
		setGameState(gameState);
		spawnEnemies();
		expect(gameState.enemies.some((e) => e.variant)).toBe(true);
	});
});

describe('debugScenario — canyon-descent-tier-2', () => {
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

	it('canyon-descent-telepipe-ready deploys Tier 2 with telepipe in hand', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForStateUpdateWithRun(socket);
		socket.emit('debugScenario', { name: 'canyon-descent-telepipe-ready' });
		const result = await debugResultPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('canyon-descent-telepipe-ready');
		expect(stateUpdate.gamePhase).toBe('playing');
		expect(stateUpdate.selectedQuestId).toBe(CANYON_DESCENT_ID);
		expect(stateUpdate.selectedQuestTier).toBe(CANYON_DESCENT_TIER_2);

		const player = playerForSocket(socket);
		expect(player.hand.some((card) => card && card.id === 'telepipe')).toBe(true);
	});

	it('deploys canyon_descent Tier 2 stage-boss run with encounter and rigid layout', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForStateUpdateWithRun(socket);
		socket.emit('debugScenario', { name: 'canyon-descent-tier-2' });
		const result = await debugResultPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('canyon-descent-tier-2');

		const state = lobbyStateForSocket(socket);
		const tier2Quest = getQuest(CANYON_DESCENT_ID, CANYON_DESCENT_TIER_2);
		const addCount = tier2Quest.encounter.addCount;

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(CANYON_DESCENT_ID);
		expect(state.selectedQuestTier).toBe(CANYON_DESCENT_TIER_2);
		expect(stateUpdate.run.questId).toBe(CANYON_DESCENT_ID);
		expect(stateUpdate.run.questTier).toBe(CANYON_DESCENT_TIER_2);
		expect(stateUpdate.run.questName).toBe(tier2Quest.name);
		expect(getQuest(CANYON_DESCENT_ID, state.selectedQuestTier).encounter?.addCount).toBe(
			addCount,
		);
		expect(stateUpdate.run.objective.type).toBe('stage_boss');
		expect(stateUpdate.run.objective.label).toContain(tier2Quest.name);
		expect(stateUpdate.run.encounter).toBeTruthy();
		expect(stateUpdate.run.encounter.bossEnemyId).toBeTruthy();
		expect(state.layout.profile).toBe('sunken-canyon');
		expect(getLayoutGenerationOptions(CANYON_DESCENT_ID, CANYON_DESCENT_TIER_2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(CANYON_DESCENT_ID, CANYON_DESCENT_TIER_2));
		expect(stateUpdate.enemies.length).toBe(1 + addCount);
		expect(
			stateUpdate.enemies.some((e) => e.id === stateUpdate.run.encounter.bossEnemyId),
		).toBe(true);
		expect(stateUpdate.enemies.every((e) => e.variant !== undefined)).toBe(true);
		expect(resolveVariantRollTier(stateUpdate.run.questTier, 0)).toBe(1);
	});

	it('Tier 2 variant rolls tag enemies under fixed seed 4242 (canyon_descent_tier2 parity)', () => {
		const SEED = 4242;
		resetGameState();
		const layout = generateLayout(
			SEED,
			getLayoutProfileForQuest(CANYON_DESCENT_ID, CANYON_DESCENT_TIER_2),
			getLayoutGenerationOptions(CANYON_DESCENT_ID, CANYON_DESCENT_TIER_2),
		);
		gameState.selectedQuestId = CANYON_DESCENT_ID;
		gameState.selectedQuestTier = CANYON_DESCENT_TIER_2;
		gameState.layout = layout;
		gameState.layoutSeed = SEED;
		gameState.enemies = [];
		gameState.loot = [];
		gameState.run = { questTier: CANYON_DESCENT_TIER_2 };
		setGameState(gameState);
		spawnEnemies();
		expect(gameState.enemies.some((e) => e.variant)).toBe(true);
		expect(gameState.enemies.filter((e) => e.type === 'miniboss')).toHaveLength(1);
	});

	it('repositions beside live adds after canyon-descent-tier-2 deploy', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'canyon-descent-tier-2' });
		const tier2Result = await tier2Promise;
		expect(tier2Result.ok).toBe(true);

		const state = testGameState();
		const player = playerForSocket(socket);
		const bossId = state.run.encounter.bossEnemyId;
		const monolith = state.layout.landmarks.find((lm) => lm.type === 'canyon_monolith');
		const bossBefore = state.enemies.find((e) => e.id === bossId);
		const addsBefore = state.enemies.filter(
			(e) => e.hp > 0 && e.type !== 'miniboss' && (e.type === 'grunt' || e.type === 'skirmisher'),
		);
		expect(addsBefore.length).toBeGreaterThan(0);

		const nearAddsPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'canyon-descent-near-adds' });
		const nearAddsResult = await nearAddsPromise;
		await stateUpdatePromise;

		expect(nearAddsResult.ok).toBe(true);
		expect(nearAddsResult.scenario).toBe('canyon-descent-near-adds');

		expect(player.hand[0]?.type).toBe('weapon');
		expect(player.hand[0]?.remainingCharges).toBeGreaterThan(0);
		expect(
			state.enemies.filter(
				(e) => e.hp > 0 && e.type !== 'miniboss' && (e.type === 'grunt' || e.type === 'skirmisher'),
			).every((e) => e.hp === 1 && !e.shieldHp),
		).toBe(true);

		const bossAfter = state.enemies.find((e) => e.id === bossId);
		expect(bossAfter?.x).toBe(bossBefore.x);
		expect(bossAfter?.z).toBe(bossBefore.z);
		expect(bossAfter?.x).toBe(monolith.x);
		expect(bossAfter?.z).toBe(monolith.z);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

		let nearest = addsBefore[0];
		let bestDist = Infinity;
		for (const add of state.enemies.filter(
			(e) => e.hp > 0 && e.type !== 'miniboss' && (e.type === 'grunt' || e.type === 'skirmisher'),
		)) {
			const dist = Math.hypot(add.x - player.x, add.z - player.z);
			if (dist < bestDist) {
				bestDist = dist;
				nearest = add;
			}
		}
		expect(bestDist).toBeGreaterThanOrEqual(2);
		expect(bestDist).toBeLessThanOrEqual(5);
	});

	it('places player outside dormant boss trigger after adds cleared', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'canyon-descent-tier-2' });
		await tier2Promise;

		const state = testGameState();
		const bossId = state.run.encounter.bossEnemyId;
		for (const enemy of state.enemies) {
			if (enemy.id !== bossId) enemy.hp = 0;
		}
		state.enemies = state.enemies.filter((e) => e.hp > 0);

		const approachPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'canyon-descent-boss-approach' });
		const approachResult = await approachPromise;

		expect(approachResult.ok).toBe(true);
		expect(approachResult.scenario).toBe('canyon-descent-boss-approach');

		const player = playerForSocket(socket);
		const anchor = resolveEncounterAnchor(state.run, state);
		const distFromAnchor = Math.hypot(anchor.x - player.x, anchor.z - player.z);
		expect(distFromAnchor).toBeGreaterThan(ENCOUNTER_TRIGGER_RADIUS);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

		for (let i = 0; i < 30; i++) {
			runGameLoopTick();
		}
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
		expect(Math.hypot(anchor.x - player.x, anchor.z - player.z)).toBeGreaterThan(
			ENCOUNTER_TRIGGER_RADIUS,
		);
	});

	it('positions miniboss at 1 HP beside the player in playing phase', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'canyon-descent-tier-2' });
		await tier2Promise;

		const lowHpPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'canyon-descent-boss-low-hp' });
		const lowHpResult = await lowHpPromise;

		expect(lowHpResult.ok).toBe(true);
		expect(lowHpResult.scenario).toBe('canyon-descent-boss-low-hp');

		const state = testGameState();
		expect(state.gamePhase).toBe('playing');

		const bossId = state.run.encounter.bossEnemyId;
		const boss = state.enemies.find((e) => e.id === bossId);
		expect(boss).toBeTruthy();
		expect(boss.type).toBe('miniboss');
		expect(boss.hp).toBe(1);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
		expect(state.run.encounter.locked).toBe(true);

		const player = playerForSocket(socket);
		const dist = Math.hypot(boss.x - player.x, boss.z - player.z);
		expect(dist).toBeGreaterThanOrEqual(2);
		expect(dist).toBeLessThanOrEqual(5.5);

		// The canyon encounter is active, so the game loop emits periodic stateUpdates and the
		// pre-mutation full-HP boss can race ahead of the scenario's own snapshot. Read the boss
		// HP from a stateUpdate captured AFTER the scenario result resolves: the boss is pinned at
		// 1 HP by then and is never healed, so every post-result snapshot reports hp === 1.
		const stateUpdate = await waitForEvent(socket, 'stateUpdate');
		const bossUpdate = stateUpdate.enemies.find((e) => e.id === bossId);
		expect(bossUpdate?.hp).toBe(1);
		expect(bossUpdate?.type).toBe('miniboss');
	});
});

describe('debugScenario — arena-trials-*', () => {
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

	const liveAdds = (state) =>
		state.enemies.filter(
			(e) =>
				e.hp > 0 &&
				e.type !== 'arena_champion' &&
				(e.type === 'grunt' || e.type === 'skirmisher'),
		);

	it('repositions beside live adds after arena-trials-tier-2 deploy', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-tier-2' });
		const tier2Result = await tier2Promise;
		expect(tier2Result.ok).toBe(true);

		const state = testGameState();
		const player = playerForSocket(socket);
		const bossId = state.run.encounter.bossEnemyId;
		const bossBefore = state.enemies.find((e) => e.id === bossId);
		const addsBefore = liveAdds(state);
		expect(addsBefore.length).toBeGreaterThan(0);

		const nearAddsPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'arena-trials-near-adds' });
		const nearAddsResult = await nearAddsPromise;
		await stateUpdatePromise;

		expect(nearAddsResult.ok).toBe(true);
		expect(nearAddsResult.scenario).toBe('arena-trials-near-adds');

		expect(player.hand[0]?.type).toBe('weapon');
		expect(player.hand[0]?.remainingCharges).toBeGreaterThan(0);
		expect(liveAdds(state).every((e) => e.hp === 1 && !e.shieldHp)).toBe(true);

		const bossAfter = state.enemies.find((e) => e.id === bossId);
		expect(bossAfter?.x).toBe(bossBefore.x);
		expect(bossAfter?.z).toBe(bossBefore.z);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

		let bestDist = Infinity;
		for (const add of liveAdds(state)) {
			const dist = Math.hypot(add.x - player.x, add.z - player.z);
			if (dist < bestDist) bestDist = dist;
		}
		expect(bestDist).toBeGreaterThanOrEqual(2);
		expect(bestDist).toBeLessThanOrEqual(5);
	});

	it('rejects arena-trials-near-adds without an active arena_trials run', async () => {
		const { socket } = await connectClient(baseUrl);

		const resultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-near-adds' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/arena_trials Tier 2 stage-boss run/);
	});

	it('places player outside dormant boss trigger after adds cleared', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-tier-2' });
		await tier2Promise;

		const state = testGameState();
		const bossId = state.run.encounter.bossEnemyId;
		clearNonBossEnemies(state, bossId);

		const approachPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-boss-approach' });
		const approachResult = await approachPromise;

		expect(approachResult.ok).toBe(true);
		expect(approachResult.scenario).toBe('arena-trials-boss-approach');

		const player = playerForSocket(socket);
		const dais = state.layout.landmarks.find((lm) => lm.type === 'arena_dais');
		const anchor = resolveEncounterAnchor(state.run, state)
			|| (dais ? { x: dais.x, z: dais.z } : null);
		expect(anchor).toBeTruthy();
		const distFromAnchor = Math.hypot(anchor.x - player.x, anchor.z - player.z);
		expect(distFromAnchor).toBeGreaterThan(ENCOUNTER_TRIGGER_RADIUS);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
	});

	it('rejects arena-trials-boss-approach while adds remain', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-tier-2' });
		await tier2Promise;

		const approachPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-boss-approach' });
		const approachResult = await approachPromise;

		expect(approachResult.ok).toBe(false);
		expect(approachResult.reason).toMatch(/Adds must be cleared/);
	});

	it('positions arena champion at 1 HP beside the player in playing phase', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-tier-2' });
		await tier2Promise;

		const lowHpPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'arena-trials-boss-low-hp' });
		const lowHpResult = await lowHpPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(lowHpResult.ok).toBe(true);
		expect(lowHpResult.scenario).toBe('arena-trials-boss-low-hp');

		const state = testGameState();
		expect(state.gamePhase).toBe('playing');

		const bossId = state.run.encounter.bossEnemyId;
		const boss = state.enemies.find((e) => e.id === bossId);
		expect(boss).toBeTruthy();
		expect(boss.type).toBe('arena_champion');
		expect(boss.hp).toBe(1);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.ACTIVE);
		expect(state.run.encounter.locked).toBe(true);

		const player = playerForSocket(socket);
		const dist = Math.hypot(boss.x - player.x, boss.z - player.z);
		expect(dist).toBeGreaterThanOrEqual(2);
		expect(dist).toBeLessThanOrEqual(5.5);

		const bossUpdate = stateUpdate.enemies.find((e) => e.id === bossId);
		expect(bossUpdate?.hp).toBe(1);
		expect(bossUpdate?.type).toBe('arena_champion');
	});

	it('rejects arena-trials-boss-low-hp without an active arena_trials run', async () => {
		const { socket } = await connectClient(baseUrl);

		const resultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'arena-trials-boss-low-hp' });
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/arena_trials Tier 2 stage-boss run/);
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

	it('deploys spire_ascent Tier 2 stage-boss run with encounter and rigid layout', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForStateUpdateWithRun(socket);
		socket.emit('debugScenario', { name: 'spire-ascent-tier-2' });
		const result = await debugResultPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('spire-ascent-tier-2');

		const state = lobbyStateForSocket(socket);
		const tier2Quest = getQuest(SPIRE_ASCENT_ID, SPIRE_ASCENT_TIER_2);
		const addCount = tier2Quest.encounter.addCount;

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(SPIRE_ASCENT_ID);
		expect(state.selectedQuestTier).toBe(SPIRE_ASCENT_TIER_2);
		expect(stateUpdate.run.questId).toBe(SPIRE_ASCENT_ID);
		expect(stateUpdate.run.questTier).toBe(SPIRE_ASCENT_TIER_2);
		expect(stateUpdate.run.questName).toBe(tier2Quest.name);
		expect(getQuest(SPIRE_ASCENT_ID, state.selectedQuestTier).encounter?.addCount).toBe(
			addCount,
		);
		expect(stateUpdate.run.objective.type).toBe('stage_boss');
		expect(stateUpdate.run.objective.label).toContain(tier2Quest.name);
		expect(stateUpdate.run.encounter).toBeTruthy();
		expect(stateUpdate.run.encounter.bossEnemyId).toBeTruthy();
		expect(state.layout.profile).toBe('spire-ascent');
		expect(getLayoutGenerationOptions(SPIRE_ASCENT_ID, SPIRE_ASCENT_TIER_2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(SPIRE_ASCENT_ID, SPIRE_ASCENT_TIER_2));
		expect(stateUpdate.enemies.length).toBe(1 + addCount);
		expect(
			stateUpdate.enemies.some((e) => e.id === stateUpdate.run.encounter.bossEnemyId),
		).toBe(true);
		expect(
			stateUpdate.enemies.some((e) => e.type === 'spire_warden'),
		).toBe(true);
		expect(stateUpdate.enemies.every((e) => e.variant !== undefined)).toBe(true);
		expect(resolveVariantRollTier(stateUpdate.run.questTier, 0)).toBe(1);
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
		gameState.gamePhase = 'playing';
		gameState.run = { questTier: SPIRE_ASCENT_TIER_2 };
		setGameState(gameState);
		spawnEnemies();
		expect(gameState.enemies.some((e) => e.variant)).toBe(true);
		expect(gameState.enemies.filter((e) => e.type === 'spire_warden')).toHaveLength(1);
	});
});

describe('debugScenario — spire-ascent-tier-2 harness shortcuts', () => {
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

	it('repositions beside live adds after spire-ascent-tier-2 deploy', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'spire-ascent-tier-2' });
		const tier2Result = await tier2Promise;
		expect(tier2Result.ok).toBe(true);

		const state = testGameState();
		const player = playerForSocket(socket);
		const addsBefore = state.enemies.filter(
			(e) => e.hp > 0 && e.type !== 'spire_warden',
		);
		expect(addsBefore.length).toBeGreaterThan(0);

		const nearAddsPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'spire-ascent-near-adds' });
		const nearAddsResult = await nearAddsPromise;
		await stateUpdatePromise;

		expect(nearAddsResult.ok).toBe(true);
		expect(nearAddsResult.scenario).toBe('spire-ascent-near-adds');

		expect(player.hand[0]?.type).toBe('weapon');
		expect(player.hand[0]?.remainingCharges).toBeGreaterThan(0);
		expect(
			state.enemies.filter(
				(e) => e.hp > 0 && e.type !== 'spire_warden',
			).every((e) => e.hp === 1 && !e.shieldHp),
		).toBe(true);

		let nearest = addsBefore[0];
		let bestDist = Infinity;
		for (const add of addsBefore) {
			const dist = Math.hypot(add.x - player.x, add.z - player.z);
			if (dist < bestDist) {
				bestDist = dist;
				nearest = add;
			}
		}
		expect(bestDist).toBeGreaterThanOrEqual(2);
		expect(bestDist).toBeLessThanOrEqual(5);
	});

	it('places player outside dormant boss trigger after adds cleared', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'spire-ascent-tier-2' });
		await tier2Promise;

		const state = testGameState();
		const bossId = state.run.encounter.bossEnemyId;
		for (const enemy of state.enemies) {
			if (enemy.id !== bossId) enemy.hp = 0;
		}
		state.enemies = state.enemies.filter((e) => e.hp > 0);

		const approachPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'spire-ascent-boss-approach' });
		const approachResult = await approachPromise;

		expect(approachResult.ok).toBe(true);
		expect(approachResult.scenario).toBe('spire-ascent-boss-approach');

		const player = playerForSocket(socket);
		const anchor = resolveEncounterAnchor(state.run, state);
		const distFromAnchor = Math.hypot(anchor.x - player.x, anchor.z - player.z);
		expect(distFromAnchor).toBeGreaterThan(ENCOUNTER_TRIGGER_RADIUS);
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);

		for (let i = 0; i < 30; i++) {
			runGameLoopTick();
		}
		expect(state.run.encounter.phase).toBe(ENCOUNTER_PHASES.DORMANT);
		const distAfterTicks = Math.hypot(anchor.x - player.x, anchor.z - player.z);
		expect(distAfterTicks).toBeGreaterThan(ENCOUNTER_TRIGGER_RADIUS);
	});

	it('positions spire_warden at 1 HP beside the player in playing phase', async () => {
		const { socket } = await connectClient(baseUrl);

		const tier2Promise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'spire-ascent-tier-2' });
		await tier2Promise;

		const lowHpPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'spire-ascent-boss-low-hp' });
		const lowHpResult = await lowHpPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(lowHpResult.ok).toBe(true);
		expect(lowHpResult.scenario).toBe('spire-ascent-boss-low-hp');

		const state = testGameState();
		expect(state.gamePhase).toBe('playing');

		const bossId = state.run.encounter.bossEnemyId;
		const boss = state.enemies.find((e) => e.id === bossId);
		expect(boss).toBeTruthy();
		expect(boss.type).toBe('spire_warden');
		expect(boss.hp).toBe(1);

		const player = playerForSocket(socket);
		const dist = Math.hypot(boss.x - player.x, boss.z - player.z);
		expect(dist).toBeGreaterThanOrEqual(2);
		expect(dist).toBeLessThanOrEqual(5.5);

		const wardenUpdate = stateUpdate.enemies.find((e) => e.id === bossId);
		expect(wardenUpdate?.hp).toBe(1);
		expect(wardenUpdate?.type).toBe('spire_warden');
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

describe('debugScenario — fire-cavern-stage', () => {
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

	it('loads fire-cavern layout with player on rim and floor-aligned Y', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'fire-cavern-stage' });
		const result = await debugResultPromise;
		await stateUpdatePromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('fire-cavern-stage');

		const state = testGameState();
		const player = playerForSocket(socket);
		const startRoom = state.layout.rooms.find((r) => r.role === 'start');

		expect(state.layout.profile).toBe('fire-cavern');
		expect(startRoom).toBeTruthy();
		expect(startRoom.band).toBe('entry');
		expect(player.x).toBe(startRoom.x);
		expect(player.z).toBe(startRoom.z);
		expect(player.y).toBe(resolveFloorY(sampleFloorY(state.layout, player.x, player.z)));
	});
});

describe('debugScenario — fire-cavern', () => {
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

	it('deploys ember_descent tier-1 with fire-cavern layout, rim spawn, and enemies', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForStateUpdateWithRun(socket);
		socket.emit('debugScenario', { name: 'fire-cavern' });
		const result = await debugResultPromise;
		const stateUpdate = await stateUpdatePromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('fire-cavern');

		const state = testGameState();
		const player = playerForSocket(socket);
		const tier1Quest = getQuest(EMBER_DESCENT_ID, EMBER_DESCENT_TIER_1);
		const startRoom = state.layout.rooms.find((r) => r.role === 'start');

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(EMBER_DESCENT_ID);
		expect(state.selectedQuestTier).toBe(EMBER_DESCENT_TIER_1);
		expect(stateUpdate.run.questId).toBe(EMBER_DESCENT_ID);
		expect(stateUpdate.run.questTier).toBe(EMBER_DESCENT_TIER_1);
		expect(stateUpdate.run.questName).toBe(tier1Quest.name);
		expect(stateUpdate.run.objective.type).toBe('defeat_enemies');
		expect(stateUpdate.run.objective.label).toContain(tier1Quest.name);
		expect(stateUpdate.run.objective.totalEnemies).toBe(tier1Quest.enemyCount);
		expect(state.layout.profile).toBe('fire-cavern');
		expect(getLayoutGenerationOptions(EMBER_DESCENT_ID, EMBER_DESCENT_TIER_1)).toEqual({
			slopes: true,
			layoutMode: 'default',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(EMBER_DESCENT_ID, EMBER_DESCENT_TIER_1));
		expect(startRoom?.band).toBe('entry');
		expect(player.x).toBe(startRoom.x);
		expect(player.z).toBe(startRoom.z);
		expect(player.y).toBe(resolveFloorY(sampleFloorY(state.layout, player.x, player.z)));
		expect(stateUpdate.enemies.length).toBe(5);
		const allowedTypes = new Set(getEnemyPool(EMBER_DESCENT_ID, EMBER_DESCENT_TIER_1).map((e) => e.type));
		expect(stateUpdate.enemies.every((e) => allowedTypes.has(e.type))).toBe(true);
	});

	it('stays in lobby with ember_descent tier-1 fire-cavern quest for telepipe-reset QA', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'fire-telepipe-ready' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('fire-telepipe-ready');

		const state = testGameState();
		const player = playerForSocket(socket);

		expect(state.gamePhase).toBe('lobby');
		expect(state.selectedQuestId).toBe(EMBER_DESCENT_ID);
		expect(state.selectedQuestTier).toBe(EMBER_DESCENT_TIER_1);
		expect(state.layout.profile).toBe('fire-cavern');
		expect(player.ready).toBe(false);
		expect(player.hand?.some((c) => c && c.id === 'telepipe')).not.toBe(true);
	});
});

describe('debugScenario — ember-descent harness shortcuts', () => {
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

	it('repositions beside live support adds after fire-cavern deploy', async () => {
		const { socket } = await connectClient(baseUrl);

		const deployPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'fire-cavern' });
		const deployResult = await deployPromise;
		expect(deployResult.ok).toBe(true);

		const state = testGameState();
		const player = playerForSocket(socket);
		expect(state.layout.profile).toBe('fire-cavern');

		const addsBefore = state.enemies.filter(
			(e) => e.hp > 0 && e.type !== 'ember_wraith' && (e.type === 'grunt' || e.type === 'skirmisher'),
		);
		expect(addsBefore.length).toBeGreaterThan(0);

		const nearAddsPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'ember-descent-near-adds' });
		const nearAddsResult = await nearAddsPromise;
		await stateUpdatePromise;

		expect(nearAddsResult.ok).toBe(true);
		expect(nearAddsResult.scenario).toBe('ember-descent-near-adds');

		expect(player.hand[0]?.type).toBe('weapon');
		expect(player.hand[0]?.remainingCharges).toBeGreaterThan(0);

		const liveAdds = state.enemies.filter(
			(e) => e.hp > 0 && e.type !== 'ember_wraith' && (e.type === 'grunt' || e.type === 'skirmisher'),
		);
		expect(liveAdds.length).toBe(addsBefore.length);
		expect(liveAdds.every((e) => e.hp === 1 && !e.shieldHp)).toBe(true);
		for (const add of liveAdds) {
			expect(add.y).toBe(resolveFloorY(sampleFloorY(state.layout, add.x, add.z)));
		}
		expect(player.y).toBe(resolveFloorY(sampleFloorY(state.layout, player.x, player.z)));

		let bestDist = Infinity;
		for (const add of liveAdds) {
			const dist = Math.hypot(add.x - player.x, add.z - player.z);
			if (dist < bestDist) bestDist = dist;
		}
		expect(bestDist).toBeGreaterThanOrEqual(2);
		expect(bestDist).toBeLessThanOrEqual(5);
	});

	it('spawns ember_wraith with godmode off for burn QA after fire-cavern deploy', async () => {
		const { socket } = await connectClient(baseUrl);

		const deployPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'fire-cavern' });
		await deployPromise;

		playerForSocket(socket).debugGodmode = true;

		const godmodePromise = waitForEvent(socket, 'debugGodmodeResult');
		const burnPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'ember-descent-ember-wraith-burn' });
		const [godmodeResult, burnResult] = await Promise.all([godmodePromise, burnPromise]);

		expect(burnResult.ok).toBe(true);
		expect(burnResult.scenario).toBe('ember-descent-ember-wraith-burn');
		expect(godmodeResult).toEqual({ ok: true, enabled: false });

		const state = testGameState();
		const player = playerForSocket(socket);
		expect(player.debugGodmode).toBe(false);
		expect(state.enemies.length).toBe(1);
		expect(state.enemies[0].type).toBe('ember_wraith');
		expect(state.enemies[0].hp).toBeGreaterThan(0);
		expect(player.hp).toBeGreaterThan(30);
	});

	it('ember-descent-ember-wraith-burn allows burn tick damage after clearing godmode', async () => {
		vi.useFakeTimers();
		const START = 1_000_000;
		vi.setSystemTime(START);

		try {
			const { socket } = await connectClient(baseUrl);

			const deployPromise = waitForEvent(socket, 'debugScenarioResult');
			socket.emit('debugScenario', { name: 'fire-cavern' });
			await deployPromise;

			playerForSocket(socket).debugGodmode = true;

			const godmodePromise = waitForEvent(socket, 'debugGodmodeResult');
			const burnPromise = waitForEvent(socket, 'debugScenarioResult');
			socket.emit('debugScenario', { name: 'ember-descent-ember-wraith-burn' });
			await Promise.all([godmodePromise, burnPromise]);

			const state = testGameState();
			const player = playerForSocket(socket);
			expect(player.debugGodmode).toBe(false);

			sim.setGameState(state, _timeouts);
			setProgressionGameState(state);

			const hpBeforeBurn = player.hp;
			applyBurning(player, 5000);
			updateBurning();
			vi.setSystemTime(START + 500);
			updateBurning();

			expect(player.hp).toBeLessThan(hpBeforeBurn);
		} finally {
			vi.useRealTimers();
		}
	});

	it('status-mutual-exclusion-ready pins fireball and permafrost_lance with one grunt in cast range', async () => {
		const { socket } = await connectClient(baseUrl);

		const deployPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'fire-cavern' });
		await deployPromise;

		const readyPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'status-mutual-exclusion-ready' });
		const readyResult = await readyPromise;

		expect(readyResult.ok).toBe(true);
		expect(readyResult.scenario).toBe('status-mutual-exclusion-ready');

		const state = testGameState();
		const player = playerForSocket(socket);
		expect(state.gamePhase).toBe('playing');
		expect(player.magicStones).toBe(MAX_MAGIC_STONES);
		expect(player.hand[0]?.id).toBe('fireball');
		expect(player.hand[1]?.id).toBe('permafrost_lance');
		expect(state.enemies.length).toBe(1);
		const dist = Math.hypot(state.enemies[0].x - player.x, state.enemies[0].z - player.z);
		expect(dist).toBeGreaterThanOrEqual(3);
		expect(dist).toBeLessThanOrEqual(6);
	});

	it('leaves one 1-HP enemy with objective not yet complete after fire-cavern deploy', async () => {
		const { socket } = await connectClient(baseUrl);

		const deployPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'fire-cavern' });
		await deployPromise;

		const lastEnemyPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'ember-descent-last-enemy' });
		const lastEnemyResult = await lastEnemyPromise;

		expect(lastEnemyResult.ok).toBe(true);
		expect(lastEnemyResult.scenario).toBe('ember-descent-last-enemy');

		const state = testGameState();
		const player = playerForSocket(socket);
		expect(state.gamePhase).toBe('playing');
		expect(state.run.status).toBe('playing');
		expect(state.run.objective.type).toBe('defeat_enemies');
		expect(state.run.objective.defeatedEnemies).toBeLessThan(state.run.objective.totalEnemies);
		expect(state.enemies.length).toBe(1);
		expect(state.enemies[0].hp).toBe(1);
		expect(state.enemies[0].y).toBe(
			resolveFloorY(sampleFloorY(state.layout, state.enemies[0].x, state.enemies[0].z)),
		);

		const dist = Math.hypot(state.enemies[0].x - player.x, state.enemies[0].z - player.z);
		expect(dist).toBeGreaterThanOrEqual(2);
		expect(dist).toBeLessThanOrEqual(5.5);
	});
});

describe('debugScenario — frost-crossing harness shortcuts', () => {
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

	it('repositions beside live support adds after frost-crossing-tier-1 deploy', async () => {
		const { socket } = await connectClient(baseUrl);

		const deployPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'frost-crossing-tier-1' });
		const deployResult = await deployPromise;
		expect(deployResult.ok).toBe(true);

		const state = testGameState();
		const player = playerForSocket(socket);
		expect(state.layout.profile).toBe('ice-cavern');

		const addsBefore = state.enemies.filter(
			(e) => e.hp > 0 && e.type !== 'glacial_thrower' && !e.namedRare
				&& (e.type === 'grunt' || e.type === 'skirmisher'),
		);
		expect(addsBefore.length).toBeGreaterThan(0);

		const nearAddsPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('debugScenario', { name: 'frost-crossing-near-adds' });
		const nearAddsResult = await nearAddsPromise;
		await stateUpdatePromise;

		expect(nearAddsResult.ok).toBe(true);
		expect(nearAddsResult.scenario).toBe('frost-crossing-near-adds');

		expect(player.hand[0]?.type).toBe('weapon');
		expect(player.hand[0]?.remainingCharges).toBeGreaterThan(0);

		const liveAdds = state.enemies.filter(
			(e) => e.hp > 0 && e.type !== 'glacial_thrower' && !e.namedRare
				&& (e.type === 'grunt' || e.type === 'skirmisher'),
		);
		expect(liveAdds.length).toBe(addsBefore.length);
		expect(liveAdds.every((e) => e.hp === 1 && !e.shieldHp)).toBe(true);
		for (const add of liveAdds) {
			expect(add.y).toBe(resolveFloorY(sampleFloorY(state.layout, add.x, add.z)));
		}
		expect(player.y).toBe(resolveFloorY(sampleFloorY(state.layout, player.x, player.z)));

		let bestDist = Infinity;
		for (const add of liveAdds) {
			const dist = Math.hypot(add.x - player.x, add.z - player.z);
			if (dist < bestDist) bestDist = dist;
		}
		expect(bestDist).toBeGreaterThanOrEqual(2);
		expect(bestDist).toBeLessThanOrEqual(5);
	});

	it('spawns glacial_thrower with godmode off for slow QA after frost-crossing deploy', async () => {
		const { socket } = await connectClient(baseUrl);

		const deployPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'frost-crossing-tier-1' });
		await deployPromise;

		playerForSocket(socket).debugGodmode = true;

		const godmodePromise = waitForEvent(socket, 'debugGodmodeResult');
		const slowPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'frost-crossing-glacial-thrower-slow' });
		const [godmodeResult, slowResult] = await Promise.all([godmodePromise, slowPromise]);

		expect(slowResult.ok).toBe(true);
		expect(slowResult.scenario).toBe('frost-crossing-glacial-thrower-slow');
		expect(godmodeResult).toEqual({ ok: true, enabled: false });

		const state = testGameState();
		const player = playerForSocket(socket);
		expect(player.debugGodmode).toBe(false);
		expect(player.vx).toBe(0);
		expect(player.vz).toBe(0);
		expect(state.enemies.length).toBe(1);
		expect(state.enemies[0].type).toBe('glacial_thrower');
		expect(state.enemies[0].hp).toBeGreaterThan(0);
		expect(player.hp).toBeGreaterThan(30);
		const stoneRoom = state.layout.rooms.find((r) => r.band === 'stone');
		if (stoneRoom) {
			expect(player.x).toBeCloseTo(stoneRoom.x, 5);
			expect(player.z).toBeCloseTo(stoneRoom.z, 5);
		}
	});

	it('seats player on ice lip facing centre with momentum on slippery floor', async () => {
		const { socket } = await connectClient(baseUrl);

		const deployPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'frost-crossing-tier-1' });
		await deployPromise;

		const transitionPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'frost-crossing-surface-transition' });
		const transitionResult = await transitionPromise;

		expect(transitionResult.ok).toBe(true);
		expect(transitionResult.scenario).toBe('frost-crossing-surface-transition');

		const state = testGameState();
		const player = playerForSocket(socket);
		const iceRoom = state.layout.rooms.find((r) => r.band === 'ice');
		const stoneRoom = state.layout.rooms.find((r) => r.band === 'stone');
		expect(stoneRoom).toBeTruthy();
		expect(iceRoom).toBeTruthy();

		const playerRoom = state.layout.rooms.find((room) => {
			const hw = room.width / 2;
			const hd = room.depth / 2;
			return player.x >= room.x - hw && player.x <= room.x + hw
				&& player.z >= room.z - hd && player.z <= room.z + hd;
		});
		expect(playerRoom?.band).toBe('ice');
		expect(sampleFloorSurface(state.layout, player.x, player.z)).toBe('slippery');

		const speed = Math.hypot(player.vx || 0, player.vz || 0);
		expect(speed).toBeGreaterThan(0);
		const towardIce = (player.vx || 0) * (iceRoom.x - player.x)
			+ (player.vz || 0) * (iceRoom.z - player.z);
		expect(towardIce).toBeGreaterThan(0);

		for (let i = 0; i < 40; i++) {
			runGameLoopTick();
		}
		const onIce = sampleFloorSurface(state.layout, player.x, player.z) === 'slippery'
			|| state.layout.rooms.some((room) => room.band === 'ice' && (() => {
				const hw = room.width / 2;
				const hd = room.depth / 2;
				return player.x >= room.x - hw && player.x <= room.x + hw
					&& player.z >= room.z - hd && player.z <= room.z + hd;
			})());
		expect(onIce || speed > 0).toBe(true);
	});

	it('frost-crossing-telepipe-ready deploys playing frost_crossing with telepipe and partial vitals', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'frost-crossing-telepipe-ready' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('frost-crossing-telepipe-ready');

		const lobbyState = testGameState();
		const player = playerForSocket(socket);
		expect(lobbyState.gamePhase).toBe('lobby');
		expect(lobbyState.selectedQuestId).toBe(FROST_CROSSING_ID);
		expect(lobbyState.selectedQuestTier).toBe(FROST_CROSSING_TIER_1);
		expect(lobbyState.layout.profile).toBe('ice-cavern');
		expect(player.hp).toBe(60);
		expect(player.magicStones).toBe(20);
		expect(player.hand?.some((c) => c && c.id === 'telepipe')).not.toBe(true);

		player.ready = true;
		setProgressionGameStateForReady(lobbyState);
		checkAllReady();

		const state = testGameState();
		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(FROST_CROSSING_ID);
		expect(state.run?.objective?.type).toBe('defeat_enemies');
		expect(player.hand.some((c) => c && c.id === 'telepipe')).toBe(true);
		expect(player.hp).toBe(60);
		expect(player.magicStones).toBe(20);
		expect(player.hand[0]?.remainingCharges).toBeLessThan(player.hand[0]?.charges);
	});
});

describe('debugScenario — hat-shop-currency', () => {
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

	it('stays in lobby with at least APPEARANCE_CHANGE_COST and broadcasts currency', async () => {
		const { socket } = await connectClient(baseUrl);
		const player = playerForSocket(socket);
		player.currency = 0;

		const stateUpdatePromise = waitForStateUpdateWithPlayerCurrency(socket, APPEARANCE_CHANGE_COST);
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'hat-shop-currency' });
		const [result, snapshot] = await Promise.all([debugResultPromise, stateUpdatePromise]);

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('hat-shop-currency');
		expect(result.currency).toBeGreaterThanOrEqual(APPEARANCE_CHANGE_COST);

		const state = testGameState();
		expect(state.gamePhase).toBe('lobby');
		expect(player.currency).toBeGreaterThanOrEqual(APPEARANCE_CHANGE_COST);
		expect(snapshot.players[socket._playerId].currency).toBe(player.currency);
	});
});
