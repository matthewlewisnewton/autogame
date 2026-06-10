import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { generateLayout } from '../dungeon.js';

const require = createRequire(import.meta.url);
const {
  getLayoutGenerationOptions,
  getLayoutProfileForQuest,
} = require('../quests.js');

const SEED = 38603;
const ARENA_HALF = 12; // BOSS_ARENA.size / 2

const RIFT_TYPES = ['rift_ice_band', 'rift_ember_band'];

function riftMarkings(layout) {
  return layout.floorMarkings.filter(m => RIFT_TYPES.includes(m.type));
}

describe("generateBossArena arenaTheme: 'rift'", () => {
  it('appends one ice band (west) and one ember band (east) and keeps ring + dais', () => {
    const layout = generateLayout(SEED, 'boss-arena', { arenaTheme: 'rift' });

    expect(layout.floorMarkings[0]).toEqual(
      { type: 'center_ring', x: 0, z: 0, innerRadius: 2.5, outerRadius: 3.2 },
    );
    expect(layout.landmarks).toEqual([{ x: 0, z: 0, type: 'arena_dais' }]);

    const bands = riftMarkings(layout);
    expect(bands.map(b => b.type).sort()).toEqual(['rift_ember_band', 'rift_ice_band']);

    const ice = bands.find(b => b.type === 'rift_ice_band');
    const ember = bands.find(b => b.type === 'rift_ember_band');
    // Ice covers the west half, ember the east half.
    expect(ice.x + ice.width / 2).toBeLessThanOrEqual(0);
    expect(ember.x - ember.width / 2).toBeGreaterThanOrEqual(0);
  });

  it('rift markings lie fully inside the arena bounds with explicit extents', () => {
    const layout = generateLayout(SEED, 'boss-arena', { arenaTheme: 'rift' });
    for (const band of riftMarkings(layout)) {
      expect(band.width).toBeGreaterThan(0);
      expect(band.depth).toBeGreaterThan(0);
      expect(Math.abs(band.x) + band.width / 2).toBeLessThan(ARENA_HALF);
      expect(Math.abs(band.z) + band.depth / 2).toBeLessThan(ARENA_HALF);
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = generateLayout(SEED, 'boss-arena', { arenaTheme: 'rift' });
    const b = generateLayout(SEED, 'boss-arena', { arenaTheme: 'rift' });
    expect(a).toEqual(b);
  });

  it('is cosmetic only: stripping the rift markings yields the unthemed layout', () => {
    const themed = generateLayout(SEED, 'boss-arena', { arenaTheme: 'rift' });
    const plain = generateLayout(SEED, 'boss-arena');
    expect({
      ...themed,
      floorMarkings: themed.floorMarkings.filter(m => !RIFT_TYPES.includes(m.type)),
    }).toEqual(plain);
  });

  it('without arenaTheme the boss-arena layout is byte-identical to before', () => {
    const plain = generateLayout(SEED, 'boss-arena');
    expect(plain.floorMarkings).toEqual([
      { type: 'center_ring', x: 0, z: 0, innerRadius: 2.5, outerRadius: 3.2 },
    ]);

    // Existing boss-arena quests stay rift-free.
    for (const questId of ['crucible_duel', 'vault_onslaught']) {
      const options = getLayoutGenerationOptions(questId, 1);
      expect(options).toEqual({ slopes: true, layoutMode: 'default' });
      const layout = generateLayout(
        SEED,
        getLayoutProfileForQuest(questId, 1),
        options,
      );
      expect(riftMarkings(layout)).toHaveLength(0);
      expect(layout).toEqual(plain);
    }
  });
});

describe('rift_convergence arenaTheme wiring', () => {
  it('getLayoutGenerationOptions passes the tier def arenaTheme through', () => {
    expect(getLayoutGenerationOptions('rift_convergence', 1)).toEqual({
      slopes: true,
      layoutMode: 'default',
      arenaTheme: 'rift',
    });
  });

  it('a generated rift_convergence layout contains both rift marking types', () => {
    const layout = generateLayout(
      SEED,
      getLayoutProfileForQuest('rift_convergence', 1),
      getLayoutGenerationOptions('rift_convergence', 1),
    );
    expect(layout.profile).toBe('boss-arena');
    expect(riftMarkings(layout).map(b => b.type).sort()).toEqual([
      'rift_ember_band',
      'rift_ice_band',
    ]);
  });
});
