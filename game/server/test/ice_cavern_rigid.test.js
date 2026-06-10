import { describe, it, expect } from 'vitest';
import { generateLayout, questLayoutSeed } from '../dungeon.js';

const PROFILE = 'ice-cavern';

function rigidLayout(seed) {
  return generateLayout(seed, PROFILE, { slopes: true, layoutMode: 'rigid' });
}

function defaultLayout(seed, options = { slopes: true }) {
  return generateLayout(seed, PROFILE, options);
}

function roomsByBand(layout, band) {
  return layout.rooms.filter((r) => r.band === band);
}

function withinPad(piece, pad) {
  return (
    Math.abs(piece.x - pad.x) <= pad.width / 2 &&
    Math.abs(piece.z - pad.z) <= pad.depth / 2
  );
}

describe('ice-cavern rigid layout mode', () => {
  it('rigid geometry is stable across distinct seeds', () => {
    const seeds = [1, 9999, questLayoutSeed('frost_crossing', 2)];
    const [a, b, c] = seeds.map(rigidLayout);

    for (const other of [b, c]) {
      expect(other.rooms).toEqual(a.rooms);
      expect(other.passages).toEqual(a.passages);
      expect(other.cover).toEqual(a.cover);
      expect(other.entryDecor).toEqual(a.entryDecor);
      expect(other.landmarks).toEqual(a.landmarks);
    }
  });

  it('rigid keeps the canonical ice-cavern structure with exactly 2 ramps', () => {
    const layout = rigidLayout(7);

    const entry = layout.rooms.find((r) => r.role === 'start');
    expect(entry).toMatchObject({ band: 'entry', floorSurface: 'normal', spawnWeight: 0 });

    const ramps = roomsByBand(layout, 'ramp');
    expect(ramps).toHaveLength(2);
    expect(ramps.map((r) => r.x).sort((m, n) => m - n)).toEqual([-3, 3]);
    expect(ramps.every((r) => r.role === 'connector')).toBe(true);
    expect(layout.passages).toHaveLength(2);

    const ice = roomsByBand(layout, 'ice')[0];
    expect(ice).toMatchObject({ floorSurface: 'slippery', spawnWeight: 2 });

    const treasure = layout.rooms.find((r) => r.role === 'treasure');
    expect(treasure.band).toBe('stone');
    expect(layout.landmarks).toEqual([
      { x: treasure.x, z: treasure.z, type: 'ice_cairn' },
    ]);
  });

  it('rigid places 2 declaration-order cover pieces per stone pad and fixed entry decor', () => {
    const layout = rigidLayout(123);
    const entry = layout.rooms.find((r) => r.role === 'start');
    const treasure = layout.rooms.find((r) => r.role === 'treasure');

    expect(layout.cover).toHaveLength(4);
    const entryCover = layout.cover.filter((c) => withinPad(c, entry));
    const treasureCover = layout.cover.filter((c) => withinPad(c, treasure));
    expect(entryCover).toHaveLength(2);
    expect(treasureCover).toHaveLength(2);

    // First two stoneCandidatePool entries (declaration order), pad-anchored.
    for (const [pad, cover] of [[entry, entryCover], [treasure, treasureCover]]) {
      expect(cover).toEqual([
        { x: pad.x - 3, z: pad.z - 3, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
        { x: pad.x + 3, z: pad.z + 3, width: 1.6, depth: 1.6, height: 3.0, type: 'pillar' },
      ]);
    }

    expect(layout.entryDecor).toHaveLength(2);
    for (const decor of layout.entryDecor) {
      expect(decor.type).toBe('icicle_cluster');
      expect(decor.yaw).toBe(0);
      expect(withinPad(decor, entry)).toBe(true);
    }
  });

  it('default mode output is unchanged from pre-rigid behavior for seed 42', () => {
    // Values snapshotted from generateLayout(42, 'ice-cavern', { slopes: true })
    // before the rigid branch was added; default RNG draws must be undisturbed.
    const layout = defaultLayout(42);

    expect(layout.rooms).toHaveLength(5);
    const ramps = roomsByBand(layout, 'ramp');
    expect(ramps.map((r) => r.x).sort((m, n) => m - n)).toEqual([-3, 3]);
    expect(layout.cover).toEqual([]);
    expect(layout.entryDecor).toEqual([
      { type: 'icicle_cluster', x: 3, z: -29.5, yaw: 0.3881839371905463 },
      { type: 'icicle_cluster', x: 0, z: -36.5, yaw: 1.1667184415233303 },
      { type: 'icicle_cluster', x: -4, z: -29.5, yaw: 4.9231728398756465 },
    ]);
    expect(layout.landmarks).toEqual([{ x: 0, z: 22.5, type: 'ice_cairn' }]);
  });

  it('default mode varies ramp count across seeds; rigid differs from default', () => {
    const rampCounts = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      rampCounts.add(roomsByBand(defaultLayout(seed), 'ramp').length);
    }
    expect(rampCounts.size).toBeGreaterThan(1);

    const seed = questLayoutSeed('frost_crossing', 2);
    const rigid = rigidLayout(seed);
    const fallback = defaultLayout(seed);
    const geometryDiffers =
      JSON.stringify(rigid.rooms) !== JSON.stringify(fallback.rooms) ||
      JSON.stringify(rigid.cover) !== JSON.stringify(fallback.cover);
    expect(geometryDiffers).toBe(true);
  });

  it('unknown or absent layoutMode falls back to default behavior', () => {
    const plain = defaultLayout(7);
    const explicit = defaultLayout(7, { slopes: true, layoutMode: 'default' });
    const unknown = defaultLayout(7, { slopes: true, layoutMode: 'bogus' });

    expect(explicit).toEqual(plain);
    expect(unknown).toEqual(plain);
  });
});
