import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';
import { createGameState } from '../game-state.js';
import { getObjectiveDef } from '../objectives.js';
import { setGameState, spawnEnemies, startDungeonRun } from '../progression.js';

const require = createRequire(import.meta.url);
const {
  QUEST_DEFS,
  DEFAULT_QUEST_ID,
  getEnemyPool,
  getLayoutGenerationOptions,
  getLayoutProfileForQuest,
  getQuest,
  pickWeightedEnemyType,
} = require('../quests.js');
const { ENEMY_DEFS, setGameState: setSimulationGameState } = require('../simulation.js');
const { mulberry32 } = require('../dungeon.js');

// Map of each quest id to its expected pool, as a sorted [type, weight] list so
// assertions are order-insensitive.
const EXPECTED_POOLS = {
  training_caverns: [['grunt', 3], ['skirmisher', 2]],
  crystal_rescue: [['grunt', 2], ['skirmisher', 3]],
  arena_trials: [['grunt', 2], ['miniboss', 1], ['skirmisher', 2]],
  canyon_descent: [['grunt', 2], ['miniboss', 1], ['skirmisher', 2]],
  ember_descent: [['ember_wraith', 2], ['grunt', 3], ['skirmisher', 2]],
  spire_ascent: [['grunt', 2], ['miniboss', 1], ['skirmisher', 1], ['spawner', 2]],
  endless_siege: [['grunt', 2], ['skirmisher', 2]],
};

function poolAsSortedPairs(pool) {
  return pool
    .map((entry) => [entry.type, entry.weight])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

describe('QUEST_DEFS enemy pools', () => {
  it('gives every quest a non-empty enemyPool of valid {type, weight} entries', () => {
    for (const quest of Object.values(QUEST_DEFS)) {
      expect(Array.isArray(quest.enemyPool)).toBe(true);
      expect(quest.enemyPool.length).toBeGreaterThan(0);
      for (const entry of quest.enemyPool) {
        expect(Object.prototype.hasOwnProperty.call(ENEMY_DEFS, entry.type)).toBe(true);
        expect(typeof entry.weight).toBe('number');
        expect(entry.weight).toBeGreaterThan(0);
      }
    }
  });

  it('matches the expected pool contents (types and weights) per quest', () => {
    for (const [questId, expected] of Object.entries(EXPECTED_POOLS)) {
      expect(poolAsSortedPairs(QUEST_DEFS[questId].enemyPool)).toEqual(expected);
    }
  });

  it('keeps spawner level-exclusive to spire_ascent', () => {
    const questsWithSpawner = Object.values(QUEST_DEFS).filter((q) =>
      q.enemyPool.some((e) => e.type === 'spawner')
    );
    expect(questsWithSpawner.map((q) => q.id)).toEqual(['spire_ascent']);
  });

  it('keeps ember_wraith level-exclusive to ember_descent', () => {
    const questsWithEmberWraith = Object.values(QUEST_DEFS).filter((q) =>
      q.enemyPool.some((e) => e.type === 'ember_wraith')
    );
    expect(questsWithEmberWraith.map((q) => q.id)).toEqual(['ember_descent']);
    for (const quest of Object.values(QUEST_DEFS)) {
      const tier2 = quest.tier2EnemyPool;
      if (Array.isArray(tier2)) {
        expect(tier2.some((e) => e.type === 'ember_wraith')).toBe(false);
      }
    }
  });

  it('shares grunt and skirmisher across two or more quests', () => {
    const countQuestsWith = (type) =>
      Object.values(QUEST_DEFS).filter((q) => q.enemyPool.some((e) => e.type === type)).length;
    expect(countQuestsWith('grunt')).toBeGreaterThanOrEqual(2);
    expect(countQuestsWith('skirmisher')).toBeGreaterThanOrEqual(2);
  });
});

describe('getEnemyPool', () => {
  it('returns the pool for a valid quest id', () => {
    expect(getEnemyPool('spire_ascent')).toBe(QUEST_DEFS.spire_ascent.enemyPool);
  });

  it('falls back to the default quest pool for an unknown/invalid id', () => {
    const fallback = QUEST_DEFS[DEFAULT_QUEST_ID].enemyPool;
    expect(getEnemyPool('does_not_exist')).toBe(fallback);
    expect(getEnemyPool(undefined)).toBe(fallback);
    expect(getEnemyPool(42)).toBe(fallback);
  });

  it('returns the base pool only for tier 1 (default and explicit)', () => {
    expect(getEnemyPool('crystal_rescue')).toBe(QUEST_DEFS.crystal_rescue.enemyPool);
    expect(getEnemyPool('crystal_rescue', 1)).toBe(QUEST_DEFS.crystal_rescue.enemyPool);
  });

  it('includes ember_wraith in ember_descent tier-1 pools', () => {
    for (const pool of [getEnemyPool('ember_descent'), getEnemyPool('ember_descent', 1)]) {
      expect(pool.some((entry) => entry.type === 'ember_wraith')).toBe(true);
    }
  });

  it('merges tier2EnemyPool into the base pool for tier 2 eligible quests', () => {
    const tier2Pool = getEnemyPool('crystal_rescue', 2);
    expect(tier2Pool).toEqual([
      ...QUEST_DEFS.crystal_rescue.enemyPool,
      ...QUEST_DEFS.crystal_rescue.tier2EnemyPool,
    ]);
    expect(tier2Pool.some((entry) => entry.type === 'field_medic')).toBe(true);
  });

  it('merges ember_descent tier2EnemyPool with field_medic for tier 2', () => {
    const tier2Pool = getEnemyPool('ember_descent', 2);
    expect(tier2Pool).toEqual([
      ...QUEST_DEFS.ember_descent.enemyPool,
      ...QUEST_DEFS.ember_descent.tier2EnemyPool,
    ]);
    expect(tier2Pool.some((entry) => entry.type === 'field_medic')).toBe(true);
  });

  it('keeps field_medic out of base enemyPool and tier-2-ineligible quests', () => {
    for (const quest of Object.values(QUEST_DEFS)) {
      expect(quest.enemyPool.some((entry) => entry.type === 'field_medic')).toBe(false);
    }
    expect(getEnemyPool('arena_trials', 2).some((entry) => entry.type === 'field_medic')).toBe(
      false,
    );
    expect(getEnemyPool('spire_ascent', 2).some((entry) => entry.type === 'field_medic')).toBe(
      false,
    );
  });

  it('includes field_medic on at least two tier-2-capable quests', () => {
    const questsWithMedic = Object.keys(QUEST_DEFS).filter((questId) =>
      getEnemyPool(questId, 2).some((entry) => entry.type === 'field_medic'),
    );
    expect(questsWithMedic).toEqual(
      expect.arrayContaining(['training_caverns', 'crystal_rescue', 'canyon_descent', 'ember_descent']),
    );
    expect(questsWithMedic.length).toBeGreaterThanOrEqual(2);
  });
});

describe('field_medic tier-2 spawn weighting', () => {
  it('never appears in tier-1 pool draws for an eligible quest', () => {
    const pool = getEnemyPool('crystal_rescue', 1);
    const poolTypes = new Set(pool.map((entry) => entry.type));
    expect(poolTypes.has('field_medic')).toBe(false);
    const rng = mulberry32(4242);
    for (let i = 0; i < 500; i++) {
      expect(pickWeightedEnemyType(pool, rng)).not.toBe('field_medic');
    }
  });

  it('can appear on tier 2 but less often than common types over many seeds', () => {
    const pool = getEnemyPool('crystal_rescue', 2);
    const counts = { field_medic: 0, grunt: 0, skirmisher: 0 };
    const drawsPerSeed = 5;
    const seeds = 400;
    let sawMedic = false;
    for (let seed = 1; seed <= seeds; seed++) {
      const rng = mulberry32(seed);
      for (let i = 0; i < drawsPerSeed; i++) {
        const type = pickWeightedEnemyType(pool, rng);
        if (type in counts) {
          counts[type] += 1;
        }
        if (type === 'field_medic') {
          sawMedic = true;
        }
      }
    }
    expect(sawMedic).toBe(true);
    expect(counts.field_medic).toBeLessThan(counts.grunt);
    expect(counts.field_medic).toBeLessThan(counts.skirmisher);
  });
});

describe('ember_wraith spawn weighting', () => {
  it('can be selected for ember_descent but never for other quest pools', () => {
    const emberPool = getEnemyPool('ember_descent', 1);
    const rng = mulberry32(1);
    let sawEmberWraith = false;
    for (let i = 0; i < 500; i++) {
      if (pickWeightedEnemyType(emberPool, rng) === 'ember_wraith') {
        sawEmberWraith = true;
        break;
      }
    }
    expect(sawEmberWraith).toBe(true);

    for (const questId of Object.keys(QUEST_DEFS)) {
      if (questId === 'ember_descent') continue;
      const pool = getEnemyPool(questId, 1);
      const poolTypes = new Set(pool.map((entry) => entry.type));
      expect(poolTypes.has('ember_wraith')).toBe(false);
      const otherRng = mulberry32(4242);
      for (let i = 0; i < 200; i++) {
        expect(pickWeightedEnemyType(pool, otherRng)).not.toBe('ember_wraith');
      }
    }
  });
});

describe('pickWeightedEnemyType', () => {
  it('always returns the only type for a single-entry pool', () => {
    const pool = [{ type: 'miniboss', weight: 1 }];
    const rng = mulberry32(123);
    for (let i = 0; i < 50; i++) {
      expect(pickWeightedEnemyType(pool, rng)).toBe('miniboss');
    }
  });

  it('never returns a type outside the pool', () => {
    const pool = QUEST_DEFS.spire_ascent.enemyPool;
    const poolTypes = new Set(pool.map((e) => e.type));
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      expect(poolTypes.has(pickWeightedEnemyType(pool, rng))).toBe(true);
    }
  });

  it('is deterministic for a given seed (stable sequence)', () => {
    const pool = QUEST_DEFS.arena_trials.enemyPool;
    const drawN = (seed, n) => {
      const rng = mulberry32(seed);
      return Array.from({ length: n }, () => pickWeightedEnemyType(pool, rng));
    };
    const first = drawN(2026, 12);
    const second = drawN(2026, 12);
    expect(first).toEqual(second);
  });

  it('selects higher-weighted types more often over a large sample', () => {
    // grunt weight 3 should dominate skirmisher weight 1.
    const pool = [{ type: 'grunt', weight: 3 }, { type: 'skirmisher', weight: 1 }];
    const rng = mulberry32(99);
    const counts = { grunt: 0, skirmisher: 0 };
    const samples = 10000;
    for (let i = 0; i < samples; i++) {
      counts[pickWeightedEnemyType(pool, rng)]++;
    }
    expect(counts.grunt).toBeGreaterThan(counts.skirmisher);
    // Roughly 3:1; allow generous tolerance for sampling noise.
    const gruntRatio = counts.grunt / samples;
    expect(gruntRatio).toBeGreaterThan(0.65);
    expect(gruntRatio).toBeLessThan(0.85);
  });

  it('defaults rng to Math.random when omitted', () => {
    const pool = [{ type: 'grunt', weight: 1 }];
    expect(pickWeightedEnemyType(pool)).toBe('grunt');
  });
});

const TIER1_SCRIPTED_QUESTS = ['training_caverns', 'crystal_rescue', 'frost_crossing'];

function deployTier1ScriptedQuest(questId) {
  const tier = 1;
  const seed = questLayoutSeed(questId, tier);
  const layout = generateLayout(
    seed,
    getLayoutProfileForQuest(questId, tier),
    getLayoutGenerationOptions(questId, tier),
  );
  const startRoom = layout.rooms.find((room) => room.role === 'start') || layout.rooms[0];
  const state = createGameState();

  state.selectedQuestId = questId;
  state.selectedQuestTier = tier;
  state.layout = layout;
  state.layoutSeed = seed;
  state.enemies = [];
  state.loot = [];
  state.gamePhase = 'playing';
  state.players = {
    p1: {
      x: startRoom.x,
      y: 0.5,
      z: startRoom.z,
      hp: 100,
      dead: false,
      extracted: false,
    },
  };
  setGameState(state);
  setSimulationGameState(state);
  spawnEnemies();
  startDungeonRun();
  return state;
}

describe('tier-1 scripted quest enemy pools', () => {
  it.each(TIER1_SCRIPTED_QUESTS)('%s keeps enemyPool for tier-2 compatibility', (questId) => {
    expect(QUEST_DEFS[questId].enemyPool.length).toBeGreaterThan(0);
    expect(getEnemyPool(questId, 1)).toBe(QUEST_DEFS[questId].enemyPool);
  });

  it.each(TIER1_SCRIPTED_QUESTS)('%s tier-1 deploy never bulk-spawns from enemyPool', (questId) => {
    const quest = getQuest(questId, 1);
    const def = getObjectiveDef(quest.objectiveType);
    expect(def.skipBulkCombatSpawn(quest)).toBe(true);

    const state = deployTier1ScriptedQuest(questId);
    expect(state.run.scriptedEncounter).toBeDefined();
    if (questId === 'frost_crossing') {
      expect(state.run.objective.type).toBe('stage_boss');
      expect(state.enemies).toHaveLength(3);
      expect(state.enemies.filter((enemy) => enemy.scriptedWave)).toHaveLength(2);
      expect(state.enemies.some((enemy) => enemy.type === 'permafrost_warden')).toBe(true);
    } else {
      expect(state.enemies.every((enemy) => enemy.scriptedWave)).toBe(true);
      expect(state.enemies.length).toBeLessThanOrEqual(3);
    }
  });
});
