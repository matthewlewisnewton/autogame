import { describe, it, expect, beforeEach } from 'vitest';
import { mulberry32, generateLayout } from '../dungeon';
import { applyVariant, resolveVariantRollTier } from '../enemyVariants';
import {
  spawnEnemy,
  spawnEnemies,
  gameState,
  resetGameState,
} from '../index.js';

const BATCH_SIZE = 500;
const SEED = 4242;

function tagCountForQuestTier(questTier, encounterTier, seed = SEED) {
  let tagged = 0;
  const rng = mulberry32(seed);
  const rollTier = resolveVariantRollTier(questTier, encounterTier);
  for (let i = 0; i < BATCH_SIZE; i++) {
    const enemy = {};
    applyVariant(enemy, rollTier, rng);
    if (enemy.variant) tagged++;
  }
  return tagged;
}

describe('variant rate by quest tier (deterministic batches)', () => {
  it('Tier 1 produces no tagged enemies; Tier 2 produces a materially higher count on the same seed', () => {
    const tier1 = tagCountForQuestTier(1, 0.8);
    const tier2 = tagCountForQuestTier(2, 0.8);
    expect(tier1).toBe(0);
    expect(tier2).toBeGreaterThan(50);
    expect(tier2).toBeGreaterThan(tier1);
  });

  it('open-plaza encounterTier 0 still rolls variants on Tier 2', () => {
    expect(resolveVariantRollTier(2, 0)).toBeGreaterThan(0);
    const tagged = tagCountForQuestTier(2, 0);
    expect(tagged).toBeGreaterThan(50);
  });

  it('Tier 1 at encounterTier 0 never tags', () => {
    expect(tagCountForQuestTier(1, 0)).toBe(0);
  });
});

describe('spawn wiring respects quest-tier variant scaling', () => {
  beforeEach(() => resetGameState());

  it('spawnEnemy tags on Tier 2 with encounterTier 0 (open-plaza path)', () => {
    gameState.enemies = [];
    gameState.run = { questTier: 2 };
    const rng = mulberry32(SEED);
    let tagged = 0;
    for (let i = 0; i < BATCH_SIZE; i++) {
      const enemy = spawnEnemy(gameState, 0, 0, 'grunt', undefined, { tier: 0, rng });
      if (enemy.variant) tagged++;
    }
    expect(tagged).toBeGreaterThan(50);
  });

  it('spawnEnemy does not tag Tier 1 combat-room encounterTier on the same seed batch', () => {
    gameState.enemies = [];
    gameState.run = { questTier: 1 };
    const rng = mulberry32(SEED);
    for (let i = 0; i < BATCH_SIZE; i++) {
      const enemy = spawnEnemy(gameState, 0, 0, 'grunt', undefined, { tier: 0.9, rng });
      expect(enemy.variant).toBeNull();
    }
  });

  it('spawnEnemies on open-plaza tags enemies when run quest tier is 2', () => {
    const layout = generateLayout(SEED, 'open-plaza');
    expect(layout.rooms[0].encounterTier ?? 0).toBe(0);

    gameState.selectedQuestId = 'arena_trials';
    gameState.layout = layout;
    gameState.layoutSeed = SEED;
    gameState.enemies = [];
    gameState.run = { questTier: 2 };
    spawnEnemies(gameState);

    const tagged = gameState.enemies.filter((e) => e.variant).length;
    expect(gameState.enemies.length).toBeGreaterThan(0);
    expect(tagged).toBeGreaterThan(0);
  });

  it('spawnEnemies on open-plaza leaves variants null at run quest tier 1', () => {
    const layout = generateLayout(SEED, 'open-plaza');
    gameState.selectedQuestId = 'arena_trials';
    gameState.layout = layout;
    gameState.layoutSeed = SEED;
    gameState.enemies = [];
    gameState.run = { questTier: 1 };
    spawnEnemies(gameState);

    expect(gameState.enemies.length).toBeGreaterThan(0);
    expect(gameState.enemies.every((e) => e.variant === null)).toBe(true);
  });
});