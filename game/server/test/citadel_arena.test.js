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
const CENTER_RING_OUTER = 3.2;

const CITADEL_TYPES = ['citadel_rampart_ring', 'citadel_banner_band'];

function citadelMarkings(layout) {
  return layout.floorMarkings.filter(m => CITADEL_TYPES.includes(m.type));
}

describe("generateBossArena arenaTheme: 'citadel'", () => {
  it('appends two concentric rampart rings and two banner bands and keeps ring + dais', () => {
    const layout = generateLayout(SEED, 'boss-arena', { arenaTheme: 'citadel' });

    expect(layout.floorMarkings[0]).toEqual(
      { type: 'center_ring', x: 0, z: 0, innerRadius: 2.5, outerRadius: 3.2 },
    );
    expect(layout.landmarks).toEqual([{ x: 0, z: 0, type: 'arena_dais' }]);

    const rings = citadelMarkings(layout).filter(m => m.type === 'citadel_rampart_ring');
    const bands = citadelMarkings(layout).filter(m => m.type === 'citadel_banner_band');
    expect(rings).toHaveLength(2);
    expect(bands).toHaveLength(2);

    // Rings are concentric on the dais, outside the center_ring, non-overlapping.
    const [inner, outer] = [...rings].sort((a, b) => a.innerRadius - b.innerRadius);
    for (const ring of [inner, outer]) {
      expect(ring.x).toBe(0);
      expect(ring.z).toBe(0);
    }
    expect(inner.innerRadius).toBeGreaterThan(CENTER_RING_OUTER);
    expect(inner.outerRadius).toBeLessThan(outer.innerRadius);

    // One banner band hugs the north wall, the other the south wall.
    expect(bands.map(b => Math.sign(b.z)).sort()).toEqual([-1, 1]);
  });

  it('citadel markings lie fully inside the arena bounds with explicit extents', () => {
    const layout = generateLayout(SEED, 'boss-arena', { arenaTheme: 'citadel' });
    for (const marking of citadelMarkings(layout)) {
      if (marking.type === 'citadel_rampart_ring') {
        expect(marking.innerRadius).toBeGreaterThan(0);
        expect(marking.outerRadius).toBeGreaterThan(marking.innerRadius);
        expect(marking.outerRadius).toBeLessThan(ARENA_HALF);
      } else {
        expect(marking.width).toBeGreaterThan(0);
        expect(marking.depth).toBeGreaterThan(0);
        expect(Math.abs(marking.x) + marking.width / 2).toBeLessThan(ARENA_HALF);
        expect(Math.abs(marking.z) + marking.depth / 2).toBeLessThan(ARENA_HALF);
      }
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = generateLayout(SEED, 'boss-arena', { arenaTheme: 'citadel' });
    const b = generateLayout(SEED, 'boss-arena', { arenaTheme: 'citadel' });
    expect(a).toEqual(b);
  });

  it('is cosmetic only: stripping the citadel markings yields the unthemed layout', () => {
    const themed = generateLayout(SEED, 'boss-arena', { arenaTheme: 'citadel' });
    const plain = generateLayout(SEED, 'boss-arena');
    expect({
      ...themed,
      floorMarkings: themed.floorMarkings.filter(m => !CITADEL_TYPES.includes(m.type)),
    }).toEqual(plain);
  });

  it('without arenaTheme the boss-arena layout carries no citadel markings', () => {
    const plain = generateLayout(SEED, 'boss-arena');
    expect(plain.floorMarkings).toEqual([
      { type: 'center_ring', x: 0, z: 0, innerRadius: 2.5, outerRadius: 3.2 },
    ]);

    // Other boss-arena quests (including the rift-themed one) stay citadel-free.
    for (const questId of ['crucible_duel', 'vault_onslaught', 'rift_convergence']) {
      const layout = generateLayout(
        SEED,
        getLayoutProfileForQuest(questId, 1),
        getLayoutGenerationOptions(questId, 1),
      );
      expect(citadelMarkings(layout)).toHaveLength(0);
    }
  });
});

describe('citadel_assault arenaTheme wiring', () => {
  it('getLayoutGenerationOptions passes the tier def arenaTheme through', () => {
    expect(getLayoutGenerationOptions('citadel_assault', 1)).toEqual({
      slopes: true,
      layoutMode: 'default',
      arenaTheme: 'citadel',
    });
  });

  it('a generated citadel_assault layout contains both citadel marking types', () => {
    const layout = generateLayout(
      SEED,
      getLayoutProfileForQuest('citadel_assault', 1),
      getLayoutGenerationOptions('citadel_assault', 1),
    );
    expect(layout.profile).toBe('boss-arena');
    expect([...new Set(citadelMarkings(layout).map(m => m.type))].sort()).toEqual([
      'citadel_banner_band',
      'citadel_rampart_ring',
    ]);
  });
});
