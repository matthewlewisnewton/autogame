import { describe, it, expect, beforeEach } from 'vitest';
import { mulberry32, generateLayout, sampleFloorY, DEFAULT_FLOOR_Y } from '../dungeon.js';
import {
  setGameState,
  getGameState,
  spawnCombatEnemies,
  buildSpireCombatTierSpawnPlan,
} from '../progression.js';
/** Five-tier spire (three combat tiers) for low / mid / top spawn coverage. */
const SPIRE_SEED = 2;
const SPAWN_RNG_SEED = 9001;

function tierContainingPosition(layout, x, z) {
  for (const room of layout.rooms) {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    if (Math.abs(x - room.x) <= halfW && Math.abs(z - room.z) <= halfD) {
      return room.tierIndex;
    }
  }
  return null;
}

function combatTierIndices(layout) {
  return layout.rooms.filter((r) => r.role === 'combat').map((r) => r.tierIndex);
}

function resetStateForLayout(layout) {
  const state = {
    layout,
    enemies: [],
    loot: [],
    players: {},
    minions: [],
    run: null,
  };
  setGameState(state);
}

describe('spire-ascent enemy spawn tiers', () => {
  let layout;
  let rng;

  beforeEach(() => {
    layout = generateLayout(SPIRE_SEED, undefined, { stage: 'spire-ascent' });
    rng = mulberry32(SPAWN_RNG_SEED);
    resetStateForLayout(layout);
  });

  it('spreads five enemies across low, middle, and top combat tiers (fixed seed)', () => {
    expect(layout.rooms.length).toBeGreaterThanOrEqual(3);
    const combatTiers = [...new Set(combatTierIndices(layout))].sort((a, b) => a - b);
    expect(combatTiers.length).toBeGreaterThanOrEqual(3);

    spawnCombatEnemies(layout, rng, { enemyCount: 5 });
    const enemies = getGameState().enemies;
    expect(enemies).toHaveLength(5);

    const spawnTiers = enemies.map((e) => tierContainingPosition(layout, e.x, e.z));
    expect(spawnTiers.every((t) => t != null)).toBe(true);
    expect(spawnTiers).not.toContain(0);

    const lowestCombat = combatTiers[0];
    const highestCombat = combatTiers[combatTiers.length - 1];
    const middleCombat = combatTiers.filter(
      (t) => t !== lowestCombat && t !== highestCombat,
    );

    expect(spawnTiers).toContain(lowestCombat);
    expect(spawnTiers).toContain(highestCombat);
    if (middleCombat.length > 0) {
      expect(spawnTiers.some((t) => middleCombat.includes(t))).toBe(true);
    }
    expect(new Set(spawnTiers).size).toBeGreaterThanOrEqual(3);
  });

  it('round-robins tiers when enemyCount is below combat tier count', () => {
    const combatTiers = [...new Set(combatTierIndices(layout))].sort((a, b) => a - b);
    if (combatTiers.length < 2) return;

    spawnCombatEnemies(layout, rng, { enemyCount: 2 });
    const spawnTiers = getGameState().enemies.map((e) =>
      tierContainingPosition(layout, e.x, e.z),
    );
    expect(new Set(spawnTiers).size).toBe(2);
    expect(spawnTiers[0]).not.toBe(spawnTiers[1]);
  });

  it('assigns enemy.y from sampleFloorY on elevated tiers', () => {
    spawnCombatEnemies(layout, rng, { enemyCount: 5 });
    const topCombatTier = Math.max(...combatTierIndices(layout));

    const elevated = getGameState().enemies.find(
      (e) => tierContainingPosition(layout, e.x, e.z) === topCombatTier,
    );
    expect(elevated).toBeDefined();
    const expectedY = sampleFloorY(layout, elevated.x, elevated.z);
    expect(elevated.y).toBe(Number.isFinite(expectedY) ? expectedY : DEFAULT_FLOOR_Y);
    expect(elevated.y).toBeGreaterThan(DEFAULT_FLOOR_Y);
  });

  it('buildSpireCombatTierSpawnPlan cycles tiers before reuse', () => {
    const combatTiers = sortedPlanTiers(layout);
    const plan = buildSpireCombatTierSpawnPlan(layout, 2, mulberry32(1));
    expect(plan).toEqual([combatTiers[0], combatTiers[1]]);
  });
});

describe('non-spire enemy spawn distribution', () => {
  it('keeps random combat-room placement for default layouts', () => {
    const layout = generateLayout(42);
    expect(layout.stage).not.toBe('spire-ascent');

    const rngA = mulberry32(100);
    resetStateForLayout(layout);
    spawnCombatEnemies(layout, rngA, { enemyCount: 5 });
    const positionsA = getGameState().enemies.map((e) => `${e.x.toFixed(3)},${e.z.toFixed(3)}`);

    const rngB = mulberry32(200);
    resetStateForLayout(layout);
    spawnCombatEnemies(layout, rngB, { enemyCount: 5 });
    const positionsB = getGameState().enemies.map((e) => `${e.x.toFixed(3)},${e.z.toFixed(3)}`);

    expect(positionsA).not.toEqual(positionsB);
    for (const enemy of getGameState().enemies) {
      const start = layout.rooms.find((r) => r.role === 'start');
      const inStart =
        Math.abs(enemy.x - start.x) < start.width / 2 &&
        Math.abs(enemy.z - start.z) < start.depth / 2;
      expect(inStart).toBe(false);
    }
  });
});

function sortedPlanTiers(layout) {
  return [...new Set(combatTierIndices(layout))].sort((a, b) => a - b);
}
