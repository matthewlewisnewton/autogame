import { describe, it, expect } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { buildWallColliders, computeWalkableAABBs, PLAYER_RADIUS } from '../simulation.js';

const WALK_STEP = 0.4;

function fireCavernLayout(seed) {
  return generateLayout(seed, 'fire-cavern');
}

function roomsByBand(layout, band) {
  return layout.rooms.filter(r => r.band === band);
}

function isWalkable(x, z, aabbs, colliders) {
  if (!aabbs.some(a => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ)) return false;
  for (const w of colliders) {
    if (x + PLAYER_RADIUS <= w.minX || x - PLAYER_RADIUS >= w.maxX) continue;
    if (z + PLAYER_RADIUS <= w.minZ || z - PLAYER_RADIUS >= w.maxZ) continue;
    return false;
  }
  return true;
}

function countReachableRooms(layout, aabbs, colliders) {
  const startRoom = layout.rooms.find(r => r.role === 'start') || layout.rooms[0];
  const seen = new Set();
  const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
  const queue = [{ x: startRoom.x, z: startRoom.z }];
  seen.add(key(startRoom.x, startRoom.z));
  const reachedRooms = new Set([`${startRoom.x},${startRoom.z}`]);
  const dirs = [[WALK_STEP, 0], [-WALK_STEP, 0], [0, WALK_STEP], [0, -WALK_STEP]];

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

function canReachPoint(fromX, fromZ, toX, toZ, aabbs, colliders) {
  const tolerance = 1.5;
  const seen = new Set();
  const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
  const queue = [{ x: fromX, z: fromZ }];
  seen.add(key(fromX, fromZ));
  const dirs = [[WALK_STEP, 0], [-WALK_STEP, 0], [0, WALK_STEP], [0, -WALK_STEP]];

  for (let qi = 0; qi < queue.length && qi < 200000; qi++) {
    const { x, z } = queue[qi];
    if (Math.hypot(x - toX, z - toZ) <= tolerance) return true;
    for (const [dx, dz] of dirs) {
      const nx = x + dx;
      const nz = z + dz;
      const k = key(nx, nz);
      if (seen.has(k) || !isWalkable(nx, nz, aabbs, colliders)) continue;
      seen.add(k);
      queue.push({ x: nx, z: nz });
    }
  }
  return false;
}

describe('fire-cavern walkability regressions', () => {
  it('flood-fills every room from rim start for regression seeds', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = fireCavernLayout(seed);
      const colliders = buildWallColliders(layout);
      const aabbs = computeWalkableAABBs(layout);
      expect(countReachableRooms(layout, aabbs, colliders)).toBe(layout.rooms.length);
    }
  });

  it('supports bidirectional rim ↔ basin centre via ramps only', () => {
    for (const seed of [1, 42, 123, 777]) {
      const layout = fireCavernLayout(seed);
      const rim = roomsByBand(layout, 'rim')[0];
      const basin = roomsByBand(layout, 'basin')[0];
      const colliders = buildWallColliders(layout);
      const aabbs = computeWalkableAABBs(layout);

      expect(canReachPoint(rim.x, rim.z, basin.x, basin.z, aabbs, colliders)).toBe(true);
      expect(canReachPoint(basin.x, basin.z, rim.x, rim.z, aabbs, colliders)).toBe(true);
    }
  });
});
