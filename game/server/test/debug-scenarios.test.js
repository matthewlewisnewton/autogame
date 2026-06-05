import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import {
	getQuest,
	getLayoutProfileForQuest,
	getLayoutGenerationOptions,
} from '../quests.js';
import { resolveVariantRollTier } from '../enemyVariants.js';
import {
	ENCOUNTER_PHASES,
	ENCOUNTER_TRIGGER_RADIUS,
} from '../encounters.js';
import { resetGameState, gameState } from '../index.js';
import { spawnEnemies, setGameState } from '../progression.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
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

	it('deploys arena_trials Tier 2 stage-boss run with encounter and rigid layout', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
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
		expect(gameState.enemies.filter((e) => e.type === 'miniboss')).toHaveLength(1);
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
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
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
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
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

	it('deploys canyon_descent Tier 2 with rigid layout, tier-2 run metadata, and variant enemies', async () => {
		const { socket } = await connectClient(baseUrl);

		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'canyon-descent-tier-2' });
		const result = await debugResultPromise;

		expect(result.ok).toBe(true);
		expect(result.scenario).toBe('canyon-descent-tier-2');

		const state = testGameState();
		const tier2Quest = getQuest(CANYON_DESCENT_ID, CANYON_DESCENT_TIER_2);

		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(CANYON_DESCENT_ID);
		expect(state.selectedQuestTier).toBe(CANYON_DESCENT_TIER_2);
		expect(state.run.questId).toBe(CANYON_DESCENT_ID);
		expect(state.run.questTier).toBe(CANYON_DESCENT_TIER_2);
		expect(state.run.questName).toBe(tier2Quest.name);
		expect(state.run.objective.label).toContain(tier2Quest.name);
		expect(state.run.objective.totalEnemies).toBe(tier2Quest.enemyCount);
		expect(state.layout.profile).toBe('sunken-canyon');
		expect(getLayoutGenerationOptions(CANYON_DESCENT_ID, CANYON_DESCENT_TIER_2)).toEqual({
			slopes: true,
			layoutMode: 'rigid',
		});
		expect(state.layoutSeed).toBe(questLayoutSeed(CANYON_DESCENT_ID, CANYON_DESCENT_TIER_2));
		expect(state.enemies.length).toBe(tier2Quest.enemyCount);
		expect(state.enemies.every((e) => e.variant !== undefined)).toBe(true);
		expect(resolveVariantRollTier(state.run.questTier, 0)).toBe(1);
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
		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
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
