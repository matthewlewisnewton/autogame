import { describe, it, expect } from 'vitest';
import {
  QUEST_DEFS,
  DEFAULT_QUEST_ID,
  getEnemyPool,
  pickWeightedEnemyType,
} from '../quests.js';
import { ENEMY_DEFS } from '../simulation.js';
import { mulberry32 } from '../dungeon.js';

// Map of each quest id to its expected pool, as a sorted [type, weight] list so
// assertions are order-insensitive.
const EXPECTED_POOLS = {
  training_caverns: [['grunt', 3], ['skirmisher', 2]],
  crystal_rescue: [['grunt', 2], ['skirmisher', 3]],
  arena_trials: [['grunt', 2], ['miniboss', 1], ['skirmisher', 2]],
  canyon_descent: [['grunt', 2], ['miniboss', 1], ['skirmisher', 2]],
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
