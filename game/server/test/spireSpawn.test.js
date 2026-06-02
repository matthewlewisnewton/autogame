import { describe, it, expect, beforeEach } from 'vitest';
import {
  mulberry32,
  generateLayout,
  questLayoutSeed,
  roomsByRole,
  randomRoomPositionByRole,
} from '../dungeon.js';
import { QUEST_DEFS } from '../quests.js';
import { buildWallColliders, computeWalkableAABBs } from '../simulation.js';
import { spawnEnemies, resetGameState, gameState } from '../index.js';

const SPIRE_SEED = 42;
const PLAYER_RADIUS = 0.45;
const WALK_STEP = 0.4;

function isWalkable(x, z, aabbs, colliders) {
  if (!aabbs.some((a) => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ)) return false;
  const pr = PLAYER_RADIUS;
  for (const w of colliders) {
    if (
      x + pr > w.minX &&
      x - pr < w.maxX &&
      z + pr > w.minZ &&
      z - pr < w.maxZ
    ) {
      return false;
    }
  }
  return true;
}

function countReachableRooms(layout, aabbs, colliders) {
  const startRoom = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
  const seen = new Set();
  const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
  const queue = [{ x: startRoom.x, z: startRoom.z }];
  seen.add(key(startRoom.x, startRoom.z));
  const reachedRooms = new Set([`${startRoom.x},${startRoom.z}`]);
  const dirs = [
    [WALK_STEP, 0],
    [-WALK_STEP, 0],
    [0, WALK_STEP],
    [0, -WALK_STEP],
  ];

  for (let qi = 0; qi < queue.length && qi < 200000; qi++) {
    const { x, z } = queue[qi];
    for (const room of layout.rooms) {
      const hw = room.width / 2;
      const hd = room.depth / 2;
      if (x >= room.x - hw && x <= room.x + hw && z >= room.z - hd && z <= room.z + hd) {
        reachedRooms.add(`${room.x},${room.z}`);
      }
    }
    for (const [dx, dz] of dirs) {
      const nx = x + dx;
      const nz = z + dz;
      const k = key(nx, nz);
      if (seen.has(k) || !isWalkable(nx, nz, aabbs, colliders)) continue;
      seen.add(k);
      queue.push({ x: nx, z: nz });
    }
  }

  return reachedRooms.size;
}

function tierRooms(layout) {
  return layout.rooms.filter((r) => r.band === 'tier');
}

function maxTierIndex(layout) {
  return Math.max(...tierRooms(layout).map((r) => r.tierIndex));
}

function roomContaining(layout, x, z) {
  for (const room of layout.rooms) {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    if (Math.abs(x - room.x) <= halfW && Math.abs(z - room.z) <= halfD) {
      return room;
    }
  }
  return null;
}

function bottomCombatTier(layout) {
  const combat = roomsByRole(layout, 'combat');
  if (combat.length === 0) return null;
  return Math.min(...combat.map((r) => r.tierIndex));
}

function deploySpire(seed = SPIRE_SEED) {
  gameState.selectedQuestId = 'spire_ascent';
  gameState.layout = generateLayout(seed, 'spire-ascent');
  gameState.layoutSeed = seed;
  gameState.enemies = [];
  gameState.loot = [];
  spawnEnemies();
}

describe('spire-ascent enemy spawns (spire_ascent quest)', () => {
  beforeEach(() => resetGameState());

  it('uses generateLayout(seed, spire-ascent) with spire_ascent quest and seeded spawn RNG', () => {
    const layout = generateLayout(SPIRE_SEED, 'spire-ascent');
    expect(layout.profile).toBe('spire-ascent');
    expect(QUEST_DEFS.spire_ascent.layoutProfile).toBe('spire-ascent');

    deploySpire();
    expect(gameState.layout.profile).toBe('spire-ascent');
    expect(gameState.selectedQuestId).toBe('spire_ascent');
    expect(gameState.enemies.length).toBe(QUEST_DEFS.spire_ascent.enemyCount);

    resetGameState();
    deploySpire();
    const first = gameState.enemies.map((e) => ({ x: e.x, z: e.z }));
    resetGameState();
    deploySpire();
    const second = gameState.enemies.map((e) => ({ x: e.x, z: e.z }));
    expect(second).toEqual(first);
  });

  it('places enemies on bottom and higher combat tiers when enemyCount ≥ 3', () => {
    deploySpire();
    const layout = gameState.layout;
    const combatTiers = [...new Set(roomsByRole(layout, 'combat').map((r) => r.tierIndex))].sort(
      (a, b) => a - b
    );
    expect(combatTiers.length).toBeGreaterThanOrEqual(2);

    const bottom = bottomCombatTier(layout);
    const tiersUsed = new Set();
    for (const enemy of gameState.enemies) {
      const room = roomContaining(layout, enemy.x, enemy.z);
      expect(room).toBeTruthy();
      expect(room.role).toBe('combat');
      tiersUsed.add(room.tierIndex);
    }
    expect(tiersUsed.has(bottom)).toBe(true);
    expect([...tiersUsed].some((t) => t > bottom)).toBe(true);
  });

  it('never spawns enemies on start rooms (spawnWeight === 0)', () => {
    deploySpire();
    const layout = gameState.layout;
    for (const enemy of gameState.enemies) {
      const room = roomContaining(layout, enemy.x, enemy.z);
      expect(room).toBeTruthy();
      expect(room.role).not.toBe('start');
      expect(room.spawnWeight).not.toBe(0);
    }
  });
});

describe('spire-ascent objective / layout placement', () => {
  it('treasure room tierIndex equals the maximum tier in the layout', () => {
    const layout = generateLayout(SPIRE_SEED, 'spire-ascent');
    const treasure = roomsByRole(layout, 'treasure')[0];
    expect(treasure.tierIndex).toBe(maxTierIndex(layout));
  });

  it('randomRoomPositionByRole places objectives inside the top-tier treasure room', () => {
    const layout = generateLayout(SPIRE_SEED, 'spire-ascent');
    const treasure = roomsByRole(layout, 'treasure')[0];
    expect(treasure.tierIndex).toBe(maxTierIndex(layout));

    const rng = mulberry32(77);
    const pos = randomRoomPositionByRole(layout, 'treasure', rng);
    const padding = 2;
    const halfW = treasure.width / 2 - padding;
    const halfD = treasure.depth / 2 - padding;
    expect(pos.x).toBeGreaterThanOrEqual(treasure.x - halfW);
    expect(pos.x).toBeLessThanOrEqual(treasure.x + halfW);
    expect(pos.z).toBeGreaterThanOrEqual(treasure.z - halfD);
    expect(pos.z).toBeLessThanOrEqual(treasure.z + halfD);
  });

  it('foot route from start tier to treasure reaches every room (ramps, no jump gaps)', () => {
    const layout = generateLayout(SPIRE_SEED, 'spire-ascent');
    const colliders = buildWallColliders(layout);
    const aabbs = computeWalkableAABBs(layout);
    expect(countReachableRooms(layout, aabbs, colliders)).toBe(layout.rooms.length);
  });

  it('quest layout seed resolves spire-ascent profile', () => {
    const seed = questLayoutSeed('spire_ascent');
    const layout = generateLayout(seed, 'spire-ascent');
    expect(layout.profile).toBe('spire-ascent');
  });
});
