import { describe, it, expect } from 'vitest';
import { generateLayout } from '../dungeon.js';
import { buildWallColliders, computeWalkableAABBs, PLAYER_RADIUS } from '../simulation.js';

const WALK_STEP = 0.4;
// Matches SUNKEN_CANYON.edgeProbeInset in dungeon.js.
const EDGE_PROBE_INSET = 2;

function sunkenCanyonLayout(seed) {
  return generateLayout(seed, 'sunken-canyon');
}

function roomsByBand(layout, band) {
  return layout.rooms.filter(r => r.band === band);
}

function hasThreeOrMoreRamps(layout) {
  return roomsByBand(layout, 'ramp').length >= 3;
}

function rampZFor(layout) {
  const ramp = roomsByBand(layout, 'ramp')[0];
  return ramp.z;
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

function rampZAxisWallsOnSpan(layout) {
  const ramp = roomsByBand(layout, 'ramp')[0];
  const zMin = ramp.z - ramp.depth / 2;
  const zMax = ramp.z + ramp.depth / 2;
  const walls = [];

  for (const room of roomsByBand(layout, 'ramp')) {
    for (const wall of room.walls) {
      if (wall.axis !== 'z') continue;
      const wzMin = wall.z - wall.length / 2;
      const wzMax = wall.z + wall.length / 2;
      if (wzMax >= zMin && wzMin <= zMax) {
        walls.push({ x: wall.x, zMin: wzMin, zMax: wzMax });
      }
    }
  }

  return walls;
}

function minRampZWallGap(walls) {
  let minGap = Infinity;
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i];
      const b = walls[j];
      if (a.zMax < b.zMin || b.zMax < a.zMin) continue;
      if (Math.abs(a.x - b.x) < 1e-6) continue;
      minGap = Math.min(minGap, Math.abs(a.x - b.x));
    }
  }
  return minGap;
}

function walkableProbeNear(xTarget, z, aabbs, colliders, searchDir = 1) {
  for (let dx = 0; dx <= 1.5; dx += 0.05) {
    const x = xTarget + searchDir * dx;
    if (isWalkable(x, z, aabbs, colliders)) return { x, z };
  }
  return null;
}

function canWalkEastWestSpan(xFrom, xTo, z, aabbs, colliders) {
  const west = walkableProbeNear(xFrom, z, aabbs, colliders, 1);
  const east = walkableProbeNear(xTo, z, aabbs, colliders, -1);
  if (!west || !east) return false;
  return canReachPoint(west.x, west.z, east.x, east.z, aabbs, colliders);
}

function canyonLateralEdgeProbes(canyon) {
  const halfW = canyon.width / 2;
  const northZ = canyon.z - canyon.depth / 2 + EDGE_PROBE_INSET;
  return [
    { x: canyon.x + (halfW - EDGE_PROBE_INSET), z: northZ },
    { x: canyon.x - (halfW - EDGE_PROBE_INSET), z: northZ },
  ];
}

function edgeRampCenters(layout) {
  const canyon = roomsByBand(layout, 'canyon')[0];
  const ramp = roomsByBand(layout, 'ramp')[0];
  const canyonHalf = canyon.width / 2;
  const rampHalfW = ramp.width / 2;
  const edgeRampX = canyonHalf - EDGE_PROBE_INSET - rampHalfW;
  return [-edgeRampX, edgeRampX];
}

function edgeRampForProbe(canyon, edgeRampCentersList, probeX) {
  const [westX, eastX] = edgeRampCentersList;
  return probeX >= canyon.x ? eastX : westX;
}

describe('sunken-canyon walkability regressions', () => {
  it('keeps ramp axis-z wall gaps ≥ 2 * PLAYER_RADIUS for three-ramp seeds 1..30', () => {
    const minAllowed = 2 * PLAYER_RADIUS;

    for (let seed = 1; seed <= 30; seed++) {
      const layout = sunkenCanyonLayout(seed);
      if (!hasThreeOrMoreRamps(layout)) continue;

      const walls = rampZAxisWallsOnSpan(layout);
      const minGap = minRampZWallGap(walls);
      expect(minGap).toBeGreaterThanOrEqual(minAllowed);
    }
  });

  it('walks east-west through the central wedge corridor at rampZ for seeds 42 and 999', () => {
    for (const seed of [42, 999]) {
      const layout = sunkenCanyonLayout(seed);
      expect(hasThreeOrMoreRamps(layout)).toBe(true);

      const colliders = buildWallColliders(layout);
      const aabbs = computeWalkableAABBs(layout);
      const z = rampZFor(layout);

      expect(canWalkEastWestSpan(-3, 3, z, aabbs, colliders)).toBe(true);
      expect(canWalkEastWestSpan(3, -3, z, aabbs, colliders)).toBe(true);
    }
  });

  it('flood-fills every room from plateau start for regression seeds', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = sunkenCanyonLayout(seed);
      const colliders = buildWallColliders(layout);
      const aabbs = computeWalkableAABBs(layout);
      expect(countReachableRooms(layout, aabbs, colliders)).toBe(layout.rooms.length);
    }
  });

  it('supports bidirectional plateau ↔ canyon centre and lateral edge probes', () => {
    for (const seed of [1, 42, 123, 777]) {
      const layout = sunkenCanyonLayout(seed);
      const plateau = roomsByBand(layout, 'plateau')[0];
      const canyon = roomsByBand(layout, 'canyon')[0];
      const rampZ = rampZFor(layout);
      const edgeRamps = edgeRampCenters(layout);
      const colliders = buildWallColliders(layout);
      const aabbs = computeWalkableAABBs(layout);

      expect(canReachPoint(plateau.x, plateau.z, canyon.x, canyon.z, aabbs, colliders)).toBe(true);
      expect(canReachPoint(canyon.x, canyon.z, plateau.x, plateau.z, aabbs, colliders)).toBe(true);

      for (const probe of canyonLateralEdgeProbes(canyon)) {
        const edgeRampX = edgeRampForProbe(canyon, edgeRamps, probe.x);

        expect(canReachPoint(plateau.x, plateau.z, probe.x, probe.z, aabbs, colliders)).toBe(true);
        expect(canReachPoint(probe.x, probe.z, plateau.x, plateau.z, aabbs, colliders)).toBe(true);
        // Edge players must reach the lateral connector ramp without detouring through canyon centre.
        expect(canReachPoint(probe.x, probe.z, edgeRampX, rampZ, aabbs, colliders)).toBe(true);
        expect(canReachPoint(edgeRampX, rampZ, plateau.x, plateau.z, aabbs, colliders)).toBe(true);
      }
    }
  });
});
