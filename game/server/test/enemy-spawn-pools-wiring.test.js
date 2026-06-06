import { describe, it, expect, beforeEach } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { getLayoutProfileForQuest, getEnemyPool, getQuest, QUEST_DEFS } from '../quests.js';
import {
	spawnEnemies,
	updateSurviveSpawns,
	startDungeonRun,
	gameState,
	resetGameState,
} from '../index.js';

// Deploy a quest the same way the live server does for bulk-combat quests:
// select the quest, build its layout, then run the seeded bulk spawner.
function deployQuest(questId, seed = 123, tier = 1) {
	gameState.selectedQuestId = questId;
	gameState.selectedQuestTier = tier;
	gameState.layout = generateLayout(seed, getLayoutProfileForQuest(questId, tier));
	gameState.layoutSeed = seed;
	gameState.enemies = [];
	gameState.loot = [];
	spawnEnemies();
}

function poolTypes(questId, tier = 1) {
	return getEnemyPool(questId, tier).map(entry => entry.type);
}

describe('spawnCombatEnemies draws from the quest enemy pool', () => {
	beforeEach(() => resetGameState());

	it('spawns only pool-valid types for a representative quest', () => {
		deployQuest('arena_trials');
		const allowed = new Set(poolTypes('arena_trials'));
		expect(gameState.enemies.length).toBeGreaterThan(0);
		for (const enemy of gameState.enemies) {
			expect(allowed.has(enemy.type)).toBe(true);
		}
	});

	it('spawns exactly quest.enemyCount enemies', () => {
		deployQuest('arena_trials');
		expect(gameState.enemies.length).toBe(getQuest('arena_trials').enemyCount);
	});

	it('never spawns miniboss for pools without one (training_caverns, crystal_rescue)', () => {
		for (const questId of ['training_caverns', 'crystal_rescue']) {
			for (const seed of [1, 7, 42, 123, 777, 9001]) {
				resetGameState();
				deployQuest(questId, seed);
				expect(poolTypes(questId)).not.toContain('miniboss');
				expect(gameState.enemies.some(e => e.type === 'miniboss')).toBe(false);
			}
		}
	});

	it('is deterministic for a fixed seed', () => {
		deployQuest('arena_trials', 555);
		const first = gameState.enemies.map(e => e.type);
		resetGameState();
		deployQuest('arena_trials', 555);
		const second = gameState.enemies.map(e => e.type);
		expect(second).toEqual(first);
	});
});

describe('ember_wraith cross-level exclusion', () => {
	beforeEach(() => resetGameState());

	it('never spawns the ember-exclusive `ember_wraith` type for non-ember quests', () => {
		const nonEmberQuests = Object.keys(QUEST_DEFS).filter(id => id !== 'ember_descent');
		for (const questId of nonEmberQuests) {
			expect(poolTypes(questId)).not.toContain('ember_wraith');
			for (const seed of [1, 42, 123, 777]) {
				resetGameState();
				deployQuest(questId, seed);
				expect(gameState.enemies.some(e => e.type === 'ember_wraith')).toBe(false);
			}
		}
	});

	it('can spawn `ember_wraith` for an ember_descent run', () => {
		expect(poolTypes('ember_descent')).toContain('ember_wraith');
		resetGameState();
		deployQuest('ember_descent', 1);
		expect(gameState.enemies.some(e => e.type === 'ember_wraith')).toBe(true);
	});
});

describe('spawner cross-level exclusion', () => {
	beforeEach(() => resetGameState());

	it('never spawns the spire-exclusive `spawner` type for non-spire quests', () => {
		const nonSpireQuests = Object.keys(QUEST_DEFS).filter(id => id !== 'spire_ascent');
		for (const questId of nonSpireQuests) {
			expect(poolTypes(questId)).not.toContain('spawner');
			for (const seed of [1, 42, 123, 777]) {
				resetGameState();
				deployQuest(questId, seed);
				expect(gameState.enemies.some(e => e.type === 'spawner')).toBe(false);
			}
		}
	});

	it('can spawn `spawner` for a spire_ascent run', () => {
		expect(poolTypes('spire_ascent')).toContain('spawner');
		let sawSpawner = false;
		for (const seed of [1, 2, 3, 5, 7, 11, 42, 123, 256, 777]) {
			resetGameState();
			deployQuest('spire_ascent', seed);
			if (gameState.enemies.some(e => e.type === 'spawner')) {
				sawSpawner = true;
				break;
			}
		}
		expect(sawSpawner).toBe(true);
	});
});

describe('tier-2 field_medic spawn wiring', () => {
	beforeEach(() => resetGameState());

	it('never spawns field_medic on tier-1 crystal_rescue runs', () => {
		for (const seed of [1, 7, 42, 123, 777, 9001]) {
			resetGameState();
			deployQuest('crystal_rescue', seed, 1);
			expect(gameState.enemies.some(e => e.type === 'field_medic')).toBe(false);
		}
	});

	it('can spawn field_medic on tier-2 crystal_rescue bulk combat', () => {
		expect(poolTypes('crystal_rescue', 2)).toContain('field_medic');
		let sawMedic = false;
		for (const seed of [1, 2, 3, 5, 7, 11, 42, 123, 256, 777, 2026]) {
			resetGameState();
			deployQuest('crystal_rescue', seed, 2);
			if (gameState.enemies.some(e => e.type === 'field_medic')) {
				sawMedic = true;
				break;
			}
		}
		expect(sawMedic).toBe(true);
	});

	it('never spawns field_medic on tier-2 arena_trials (no tier2EnemyPool)', () => {
		for (const seed of [1, 42, 123, 777]) {
			resetGameState();
			deployQuest('arena_trials', seed, 2);
			expect(gameState.enemies.some(e => e.type === 'field_medic')).toBe(false);
		}
	});
});

describe('survive regular spawns draw from the quest pool', () => {
	function startSurviveRun(questId = 'endless_siege', seed = 42) {
		resetGameState();
		gameState.selectedQuestId = questId;
		gameState.layoutSeed = seed;
		gameState.gamePhase = 'playing';
		gameState.enemies = [];
		startDungeonRun();
		return gameState.run;
	}

	function drainSpawns(run) {
		let now = 1_000_000;
		const guard = run.objective.totalSpawns + 50;
		let iterations = 0;
		while (run.objective.spawnedEnemies < run.objective.totalSpawns && iterations < guard) {
			updateSurviveSpawns(now);
			now += 60_000;
			iterations++;
		}
	}

	it('snapshots the quest enemyPool onto the survive objective', () => {
		const run = startSurviveRun();
		expect(run.objective.enemyPool).toEqual(getEnemyPool('endless_siege'));
	});

	it('regular (non-miniboss) spawns come from the quest pool, miniboss tail preserved', () => {
		const run = startSurviveRun();
		const minibossCount = run.objective.minibossCount;
		const regularTypes = new Set(
			getEnemyPool('endless_siege').filter(e => e.type !== 'miniboss').map(e => e.type)
		);

		drainSpawns(run);

		const minibosses = gameState.enemies.filter(e => e.type === 'miniboss').length;
		expect(minibosses).toBe(minibossCount);
		const regulars = gameState.enemies.filter(e => e.type !== 'miniboss');
		expect(regulars.length).toBe(run.objective.totalSpawns - minibossCount);
		for (const enemy of regulars) {
			expect(regularTypes.has(enemy.type)).toBe(true);
		}
	});
});
