import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  generateLayout,
  buildAdjacencyMap,
  bfsDistances,
  findFarthestRoom,
  assignRoomRoles,
  roomsByRole,
  randomRoomPositionByRole,
  isInsideCover,
  nudgeClearOfCover,
  randomRoomPositionClearOfCover,
  sampleFloorY,
  questLayoutSeed,
  DEFAULT_FLOOR_Y,
  LAYOUT_PROFILES,
  GRID_COLS,
  GRID_ROWS,
  CELL_SPACING,
  MIN_ROOM_SIZE,
  MAX_ROOM_SIZE_INCLUSIVE,
  PASSAGE_WIDTH
} from '../dungeon.js';
import {
  generateOpenPlaza,
  OPEN_PLAZA_SIZE,
  plazaFreeFloorConnected,
  platformBounds,
  COVER_MIN,
  COVER_SLOPED,
  COVER_SLOPE_DELTA,
  PLATFORM_APRON
} from '../dungeon.js';
import { getLayoutProfileForQuest } from '../quests.js';
import { buildWallColliders, computeWalkableAABBs } from '../simulation.js';

const PLAYER_RADIUS = 0.45;
const WALK_STEP = 0.4;

function isWalkable(x, z, aabbs, colliders) {
  if (!aabbs.some(a => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ)) return false;
  const pr = PLAYER_RADIUS;
  for (const w of colliders) {
    if (x + pr <= w.minX || x - pr >= w.maxX) continue;
    if (z + pr <= w.minZ || z - pr >= w.maxZ) continue;
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

// ── mulberry32 PRNG ──

describe('mulberry32(seed)', () => {
  it('returns a function', () => {
    expect(typeof mulberry32(42)).toBe('function');
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let differs = false;
    for (let i = 0; i < 100; i++) {
      if (a() !== b()) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });
});

// ── generateLayout ──

describe('generateLayout(seed)', () => {
  it('returns an object with rooms and passages arrays', () => {
    const layout = generateLayout(42);
    expect(Array.isArray(layout.rooms)).toBe(true);
    expect(Array.isArray(layout.passages)).toBe(true);
  });

  it('is deterministic: same seed always produces identical output (deep equality)', () => {
    const a = generateLayout(777);
    const b = generateLayout(777);

    expect(a).toEqual(b);
  });

  it('produces at least 4 rooms', () => {
    const layout = generateLayout(1);
    expect(layout.rooms.length).toBeGreaterThanOrEqual(4);
  });

  it('produces at least 4 rooms across multiple seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const layout = generateLayout(seed);
      expect(layout.rooms.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('all rooms are reachable (connected graph)', () => {
    const layout = generateLayout(42);
    const numRooms = layout.rooms.length;

    // Build adjacency from passages
    const adjacency = Array.from({ length: numRooms }, () => new Set());
    for (let i = 0; i < layout.passages.length; i++) {
      const p = layout.passages[i];
      // Find room indices by matching coordinates
      const fromIdx = layout.rooms.findIndex(r => r.x === p.x1 && r.z === p.z1);
      const toIdx = layout.rooms.findIndex(r => r.x === p.x2 && r.z === p.z2);
      if (fromIdx >= 0 && toIdx >= 0) {
        adjacency[fromIdx].add(toIdx);
        adjacency[toIdx].add(fromIdx);
      }
    }

    // BFS from room 0
    const visited = new Set();
    const queue = [0];
    visited.add(0);
    while (queue.length > 0) {
      const current = queue.shift();
      for (const neighbor of adjacency[current]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    expect(visited.size).toBe(numRooms);
  });

  it('all rooms are reachable across multiple seeds', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const layout = generateLayout(seed);
      const numRooms = layout.rooms.length;

      const adjacency = Array.from({ length: numRooms }, () => new Set());
      for (const p of layout.passages) {
        const fromIdx = layout.rooms.findIndex(r => r.x === p.x1 && r.z === p.z1);
        const toIdx = layout.rooms.findIndex(r => r.x === p.x2 && r.z === p.z2);
        if (fromIdx >= 0 && toIdx >= 0) {
          adjacency[fromIdx].add(toIdx);
          adjacency[toIdx].add(fromIdx);
        }
      }

      const visited = new Set();
      const queue = [0];
      visited.add(0);
      while (queue.length > 0) {
        const current = queue.shift();
        for (const neighbor of adjacency[current]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      expect(visited.size).toBe(numRooms);
    }
  });

  it('rooms respect grid bounds', () => {
    const layout = generateLayout(12345);
    const maxCoord = ((Math.max(GRID_COLS, GRID_ROWS) - 1) - (Math.max(GRID_COLS, GRID_ROWS) - 1) / 2) * CELL_SPACING;
    for (const room of layout.rooms) {
      expect(Math.abs(room.x)).toBeLessThanOrEqual(maxCoord);
      expect(Math.abs(room.z)).toBeLessThanOrEqual(maxCoord);
    }
  });

  it('each room has width, depth, and walls array', () => {
    const layout = generateLayout(99);
    for (const room of layout.rooms) {
      expect(room.width).toBeGreaterThanOrEqual(MIN_ROOM_SIZE);
      expect(room.width).toBeLessThanOrEqual(MAX_ROOM_SIZE_INCLUSIVE);
      expect(room.depth).toBeGreaterThanOrEqual(MIN_ROOM_SIZE);
      expect(room.depth).toBeLessThanOrEqual(MAX_ROOM_SIZE_INCLUSIVE);
      expect(Array.isArray(room.walls)).toBe(true);
    }
  });

  it('wall gap correctness: rooms with passage connections have split walls with PASSAGE_WIDTH gap', () => {
    const layout = generateLayout(42);

    for (const room of layout.rooms) {
      const xWalls = room.walls.filter(w => w.axis === 'x');
      const zWalls = room.walls.filter(w => w.axis === 'z');

      // For each pair of x-axis walls at the same z, verify the gap between them
      for (let i = 0; i < xWalls.length; i++) {
        for (let j = i + 1; j < xWalls.length; j++) {
          if (Math.abs(xWalls[i].z - xWalls[j].z) < 0.01) {
            // Determine which segment is left vs right by center x
            let left, right;
            if (xWalls[i].x < xWalls[j].x) { left = xWalls[i]; right = xWalls[j]; }
            else { left = xWalls[j]; right = xWalls[i]; }
            // Gap = right segment's left edge minus left segment's right edge
            const gap = (right.x - right.length / 2) - (left.x + left.length / 2);
            expect(gap).toBeCloseTo(PASSAGE_WIDTH, 4);
          }
        }
      }

      // Same check for z-axis walls
      for (let i = 0; i < zWalls.length; i++) {
        for (let j = i + 1; j < zWalls.length; j++) {
          if (Math.abs(zWalls[i].x - zWalls[j].x) < 0.01) {
            let lower, upper;
            if (zWalls[i].z < zWalls[j].z) { lower = zWalls[i]; upper = zWalls[j]; }
            else { lower = zWalls[j]; upper = zWalls[i]; }
            const gap = (upper.z - upper.length / 2) - (lower.z + lower.length / 2);
            expect(gap).toBeCloseTo(PASSAGE_WIDTH, 4);
          }
        }
      }
    }
  });

  it('rooms without passage connections have single solid walls', () => {
    const layout = generateLayout(42);

    // A room with no passage connections should have exactly 4 walls (one per side)
    // Find a room that has no passages connected to it
    // (With the current algorithm this is unlikely on a 4x4 grid, but the logic is still valid
    // for edge cases or larger grids with fewer rooms)
    for (const room of layout.rooms) {
      // Count walls per side
      const northWalls = room.walls.filter(w => w.axis === 'x' && Math.abs(w.z - (room.z - room.depth / 2)) < 0.01);
      const southWalls = room.walls.filter(w => w.axis === 'x' && Math.abs(w.z - (room.z + room.depth / 2)) < 0.01);
      const westWalls = room.walls.filter(w => w.axis === 'z' && Math.abs(w.x - (room.x - room.width / 2)) < 0.01);
      const eastWalls = room.walls.filter(w => w.axis === 'z' && Math.abs(w.x - (room.x + room.width / 2)) < 0.01);

      // Each side should have either 1 wall (solid) or 2 walls (gap)
      expect(northWalls.length).toBeGreaterThanOrEqual(1);
      expect(northWalls.length).toBeLessThanOrEqual(2);
      expect(southWalls.length).toBeGreaterThanOrEqual(1);
      expect(southWalls.length).toBeLessThanOrEqual(2);
      expect(westWalls.length).toBeGreaterThanOrEqual(1);
      expect(westWalls.length).toBeLessThanOrEqual(2);
      expect(eastWalls.length).toBeGreaterThanOrEqual(1);
      expect(eastWalls.length).toBeLessThanOrEqual(2);

      // If a side has 1 wall, it should span the full room dimension
      if (northWalls.length === 1) {
        expect(northWalls[0].length).toBeCloseTo(room.width, 4);
      }
      if (southWalls.length === 1) {
        expect(southWalls[0].length).toBeCloseTo(room.width, 4);
      }
      if (westWalls.length === 1) {
        expect(westWalls[0].length).toBeCloseTo(room.depth, 4);
      }
      if (eastWalls.length === 1) {
        expect(eastWalls[0].length).toBeCloseTo(room.depth, 4);
      }
    }
  });

  it('different seeds produce different layouts', () => {
    const a = generateLayout(1);
    const b = generateLayout(2);
    let differs = false;
    for (let i = 0; i < Math.min(a.rooms.length, b.rooms.length); i++) {
      if (a.rooms[i].x !== b.rooms[i].x || a.rooms[i].z !== b.rooms[i].z) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it('passages connect adjacent rooms (coordinates match)', () => {
    const layout = generateLayout(42);
    for (const p of layout.passages) {
      const fromRoom = layout.rooms.find(r => r.x === p.x1 && r.z === p.z1);
      const toRoom = layout.rooms.find(r => r.x === p.x2 && r.z === p.z2);
      expect(fromRoom).toBeDefined();
      expect(toRoom).toBeDefined();
      // Connected rooms should be adjacent (distance ≈ CELL_SPACING)
      const dist = Math.hypot(p.x2 - p.x1, p.z2 - p.z1);
      expect(dist).toBeCloseTo(CELL_SPACING, 0);
    }
  });

  it('passage objects have boundary walls', () => {
    const layout = generateLayout(42);
    for (const p of layout.passages) {
      expect(Array.isArray(p.walls)).toBe(true);
      expect(p.walls.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ── Exported constants ──

describe('exported constants', () => {
  it('GRID_COLS is 4', () => {
    expect(GRID_COLS).toBe(4);
  });

  it('GRID_ROWS is 4', () => {
    expect(GRID_ROWS).toBe(4);
  });

  it('CELL_SPACING is 20', () => {
    expect(CELL_SPACING).toBe(20);
  });

  it('MIN_ROOM_SIZE is 12', () => {
    expect(MIN_ROOM_SIZE).toBe(12);
  });

  it('MAX_ROOM_SIZE_INCLUSIVE is 15', () => {
    expect(MAX_ROOM_SIZE_INCLUSIVE).toBe(15);
  });

  it('PASSAGE_WIDTH is 4', () => {
    expect(PASSAGE_WIDTH).toBe(4);
  });
});

// ── buildAdjacencyMap ──

describe('buildAdjacencyMap(layout)', () => {
  it('returns a Map with an entry per room', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    expect(adj.size).toBe(layout.rooms.length);
  });

  it('each value is a Set of neighbor indices', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    for (const [idx, neighbors] of adj) {
      expect(idx >= 0 && idx < layout.rooms.length).toBe(true);
      expect(neighbors instanceof Set).toBe(true);
      for (const n of neighbors) {
        expect(n >= 0 && n < layout.rooms.length).toBe(true);
      }
    }
  });

  it('adjacency is symmetric (undirected graph)', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    for (const [a, neighbors] of adj) {
      for (const b of neighbors) {
        expect(adj.get(b).has(a)).toBe(true);
      }
    }
  });

  it('total edges match passage count', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    let edgeSum = 0;
    for (const [, neighbors] of adj) {
      edgeSum += neighbors.size;
    }
    // Each passage contributes 2 directed edges
    expect(edgeSum).toBe(layout.passages.length * 2);
  });

  it('graph is connected (BFS from 0 reaches all nodes)', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    const visited = new Set();
    const queue = [0];
    visited.add(0);
    while (queue.length > 0) {
      const current = queue.shift();
      for (const n of adj.get(current)) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    expect(visited.size).toBe(layout.rooms.length);
  });
});

// ── bfsDistances ──

describe('bfsDistances(adjacencyMap, startIdx)', () => {
  it('returns an array with length equal to room count', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    const dist = bfsDistances(adj, 0);
    expect(dist.length).toBe(layout.rooms.length);
  });

  it('start node has distance 0', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    const dist = bfsDistances(adj, 0);
    expect(dist[0]).toBe(0);
  });

  it('all distances are finite in a connected layout', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    const dist = bfsDistances(adj, 0);
    for (const d of dist) {
      expect(Number.isFinite(d)).toBe(true);
    }
  });

  it('immediate neighbors have distance 1', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    const dist = bfsDistances(adj, 0);
    for (const neighbor of adj.get(0)) {
      expect(dist[neighbor]).toBe(1);
    }
  });

  it('distances are non-decreasing along edges', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    const dist = bfsDistances(adj, 0);
    for (const [node, neighbors] of adj) {
      for (const n of neighbors) {
        expect(Math.abs(dist[n] - dist[node])).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic for the same layout', () => {
    const layout = generateLayout(777);
    const adj = buildAdjacencyMap(layout);
    const a = bfsDistances(adj, 0);
    const b = bfsDistances(adj, 0);
    expect(a).toEqual(b);
  });
});

// ── findFarthestRoom ──

describe('findFarthestRoom(layout, startRoom)', () => {
  it('returns a room from the layout', () => {
    const layout = generateLayout(42);
    const farthest = findFarthestRoom(layout, layout.rooms[0]);
    expect(layout.rooms.includes(farthest)).toBe(true);
  });

  it('farthest room is not the start room (when > 1 room)', () => {
    const layout = generateLayout(42);
    const farthest = findFarthestRoom(layout, layout.rooms[0]);
    if (layout.rooms.length > 1) {
      expect(farthest).not.toBe(layout.rooms[0]);
    }
  });

  it('returned room has maximum BFS distance from start', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    const dist = bfsDistances(adj, 0);
    const farthest = findFarthestRoom(layout, layout.rooms[0]);
    const farthestIdx = layout.rooms.indexOf(farthest);
    const maxDist = Math.max(...dist);
    expect(dist[farthestIdx]).toBe(maxDist);
  });

  it('is deterministic for the same seed', () => {
    const layout = generateLayout(999);
    const a = findFarthestRoom(layout, layout.rooms[0]);
    const b = findFarthestRoom(layout, layout.rooms[0]);
    expect(a).toBe(b); // same object reference
  });
});

// ── assignRoomRoles ──

describe('assignRoomRoles(layout)', () => {
  it('every room gets a role string', () => {
    const layout = generateLayout(42);
    for (const room of layout.rooms) {
      expect(['start', 'combat', 'treasure']).toContain(room.role);
    }
  });

  it('exactly one room has role start', () => {
    const layout = generateLayout(42);
    const starts = layout.rooms.filter(r => r.role === 'start');
    expect(starts.length).toBe(1);
  });

  it('start room is the first room (index 0)', () => {
    const layout = generateLayout(42);
    expect(layout.rooms[0].role).toBe('start');
  });

  it('exactly one room has role treasure', () => {
    const layout = generateLayout(42);
    const treasures = layout.rooms.filter(r => r.role === 'treasure');
    expect(treasures.length).toBe(1);
  });

  it('treasure room is the farthest from start', () => {
    const layout = generateLayout(42);
    const treasure = layout.rooms.find(r => r.role === 'treasure');
    const farthest = findFarthestRoom(layout, layout.rooms[0]);
    expect(treasure).toBe(farthest);
  });

  it('all remaining rooms have role combat', () => {
    const layout = generateLayout(42);
    const nonStartTreasure = layout.rooms.filter(r => r.role !== 'start' && r.role !== 'treasure');
    for (const room of nonStartTreasure) {
      expect(room.role).toBe('combat');
    }
  });

  it('start room has spawnWeight 0 and encounterTier 0', () => {
    const layout = generateLayout(42);
    expect(layout.rooms[0].spawnWeight).toBe(0);
    expect(layout.rooms[0].encounterTier).toBe(0);
  });

  it('treasure room has spawnWeight 2 and encounterTier 0', () => {
    const layout = generateLayout(42);
    const treasure = layout.rooms.find(r => r.role === 'treasure');
    expect(treasure.spawnWeight).toBe(2);
    expect(treasure.encounterTier).toBe(0);
  });

  it('combat rooms have spawnWeight 1', () => {
    const layout = generateLayout(42);
    for (const room of layout.rooms) {
      if (room.role === 'combat') {
        expect(room.spawnWeight).toBe(1);
      }
    }
  });

  it('combat room encounterTier is between 0 and 1', () => {
    const layout = generateLayout(42);
    for (const room of layout.rooms) {
      if (room.role === 'combat') {
        expect(room.encounterTier).toBeGreaterThanOrEqual(0);
        expect(room.encounterTier).toBeLessThanOrEqual(1);
      }
    }
  });

  it('encounterTier increases with BFS distance from start', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    const dist = bfsDistances(adj, 0);
    const maxDist = Math.max(...dist);
    for (let i = 0; i < layout.rooms.length; i++) {
      const room = layout.rooms[i];
      if (room.role === 'combat') {
        const expected = maxDist > 0 ? dist[i] / maxDist : 0;
        expect(room.encounterTier).toBeCloseTo(expected, 5);
      }
    }
  });

  it('existing room fields are preserved (x, z, width, depth, walls)', () => {
    const layout = generateLayout(42);
    for (const room of layout.rooms) {
      expect(typeof room.x).toBe('number');
      expect(typeof room.z).toBe('number');
      expect(typeof room.width).toBe('number');
      expect(typeof room.depth).toBe('number');
      expect(Array.isArray(room.walls)).toBe(true);
    }
  });

  it('layout remains deterministic after role assignment', () => {
    const a = generateLayout(777);
    const b = generateLayout(777);
    expect(a).toEqual(b);
  });

  it('role assignment is consistent across multiple seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const layout = generateLayout(seed);
      const starts = layout.rooms.filter(r => r.role === 'start');
      const treasures = layout.rooms.filter(r => r.role === 'treasure');
      expect(starts.length).toBe(1);
      expect(treasures.length).toBe(1);
      expect(starts[0]).toBe(layout.rooms[0]);
      for (const room of layout.rooms) {
        expect(typeof room.spawnWeight).toBe('number');
        expect(typeof room.encounterTier).toBe('number');
      }
    }
  });

  it('is deterministic — two calls with the same layout produce identical role assignments', () => {
    const layout = generateLayout(42);
    // generateLayout already calls assignRoomRoles internally, so roles are set.
    // Strip roles and re-assign twice to verify determinism.
    const rolesA = layout.rooms.map(r => ({ role: r.role, spawnWeight: r.spawnWeight, encounterTier: r.encounterTier }));
    delete layout.rooms[0].role; // clear to re-assign
    // We can't easily strip without side effects, so instead verify that two identical
    // layouts produce the same roles.
    const a = generateLayout(42);
    const b = generateLayout(42);
    for (let i = 0; i < a.rooms.length; i++) {
      expect(a.rooms[i].role).toBe(b.rooms[i].role);
      expect(a.rooms[i].spawnWeight).toBe(b.rooms[i].spawnWeight);
      expect(a.rooms[i].encounterTier).toBeCloseTo(b.rooms[i].encounterTier, 5);
    }
  });

  it('at least one room has role combat (when layout has > 1 room)', () => {
    const layout = generateLayout(42);
    if (layout.rooms.length > 1) {
      const combats = layout.rooms.filter(r => r.role === 'combat');
      expect(combats.length).toBeGreaterThan(0);
    }
  });

  it('all rooms have role, spawnWeight, and encounterTier fields', () => {
    const layout = generateLayout(42);
    for (const room of layout.rooms) {
      expect(typeof room.role).toBe('string');
      expect(['start', 'combat', 'treasure']).toContain(room.role);
      expect(typeof room.spawnWeight).toBe('number');
      expect(typeof room.encounterTier).toBe('number');
    }
  });

  it('all rooms remain reachable (BFS connectivity) after role assignment', () => {
    const layout = generateLayout(42);
    const adj = buildAdjacencyMap(layout);
    const dist = bfsDistances(adj, 0);
    // All distances should be finite — meaning every room is reachable from room 0
    for (let i = 0; i < dist.length; i++) {
      expect(dist[i]).toBeLessThan(Infinity);
    }
    // And the number of reachable rooms equals the total room count
    const reachable = dist.filter(d => d < Infinity).length;
    expect(reachable).toBe(layout.rooms.length);
  });
});

// ── roomsByRole ──

describe('roomsByRole(layout, role)', () => {
  it('returns an array', () => {
    const layout = generateLayout(42);
    expect(Array.isArray(roomsByRole(layout, 'combat'))).toBe(true);
  });

  it('returns only rooms matching the requested role', () => {
    const layout = generateLayout(42);
    const combats = roomsByRole(layout, 'combat');
    for (const room of combats) {
      expect(room.role).toBe('combat');
    }
  });

  it('returns exactly one start room', () => {
    const layout = generateLayout(42);
    expect(roomsByRole(layout, 'start').length).toBe(1);
  });

  it('returns exactly one treasure room', () => {
    const layout = generateLayout(42);
    expect(roomsByRole(layout, 'treasure').length).toBe(1);
  });

  it('returns an empty array for a non-existent role', () => {
    const layout = generateLayout(42);
    expect(roomsByRole(layout, 'boss').length).toBe(0);
  });

  it('combined role counts equal total room count', () => {
    const layout = generateLayout(42);
    const total = roomsByRole(layout, 'start').length +
      roomsByRole(layout, 'combat').length +
      roomsByRole(layout, 'treasure').length;
    expect(total).toBe(layout.rooms.length);
  });

  it('is deterministic for the same layout', () => {
    const layout = generateLayout(777);
    const a = roomsByRole(layout, 'combat');
    const b = roomsByRole(layout, 'combat');
    expect(a).toStrictEqual(b);
  });
});

// ── randomRoomPositionByRole ──

describe('randomRoomPositionByRole(layout, role, rng)', () => {
  it('returns an object with x and z properties', () => {
    const layout = generateLayout(42);
    const rng = mulberry32(42);
    const pos = randomRoomPositionByRole(layout, 'combat', rng);
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.z).toBe('number');
  });

  it('returned position is within the bounds of a matching room', () => {
    const layout = generateLayout(42);
    const rng = mulberry32(99);
    const pos = randomRoomPositionByRole(layout, 'combat', rng);
    const combats = roomsByRole(layout, 'combat');
    const within = combats.some(r => {
      const halfW = r.width / 2;
      const halfD = r.depth / 2;
      return pos.x >= r.x - halfW && pos.x <= r.x + halfW &&
             pos.z >= r.z - halfD && pos.z <= r.z + halfD;
    });
    expect(within).toBe(true);
  });

  it('falls back to any room when role does not exist', () => {
    const layout = generateLayout(42);
    const rng = mulberry32(42);
    const pos = randomRoomPositionByRole(layout, 'nonexistent', rng);
    const within = layout.rooms.some(r => {
      const halfW = r.width / 2;
      const halfD = r.depth / 2;
      return pos.x >= r.x - halfW && pos.x <= r.x + halfW &&
             pos.z >= r.z - halfD && pos.z <= r.z + halfD;
    });
    expect(within).toBe(true);
  });

  it('is deterministic with the same seed', () => {
    const layout = generateLayout(42);
    const rngA = mulberry32(123);
    const rngB = mulberry32(123);
    const posA = randomRoomPositionByRole(layout, 'combat', rngA);
    const posB = randomRoomPositionByRole(layout, 'combat', rngB);
    expect(posA).toEqual(posB);
  });

  it('produces different positions for different seeds', () => {
    const layout = generateLayout(42);
    const posA = randomRoomPositionByRole(layout, 'combat', mulberry32(1));
    const posB = randomRoomPositionByRole(layout, 'combat', mulberry32(2));
    expect(posA).not.toEqual(posB);
  });

  it('position respects spawn padding (stays inside room edges)', () => {
    const layout = generateLayout(42);
    const rng = mulberry32(42);
    const pos = randomRoomPositionByRole(layout, 'start', rng);
    const startRoom = roomsByRole(layout, 'start')[0];
    const padding = 2;
    const halfW = startRoom.width / 2 - padding;
    const halfD = startRoom.depth / 2 - padding;
    expect(pos.x).toBeGreaterThanOrEqual(startRoom.x - halfW);
    expect(pos.x).toBeLessThanOrEqual(startRoom.x + halfW);
    expect(pos.z).toBeGreaterThanOrEqual(startRoom.z - halfD);
    expect(pos.z).toBeLessThanOrEqual(startRoom.z + halfD);
  });

  it('works correctly for treasure role', () => {
    const layout = generateLayout(42);
    const rng = mulberry32(77);
    const pos = randomRoomPositionByRole(layout, 'treasure', rng);
    const treasure = roomsByRole(layout, 'treasure')[0];
    const padding = 2;
    const halfW = treasure.width / 2 - padding;
    const halfD = treasure.depth / 2 - padding;
    expect(pos.x).toBeGreaterThanOrEqual(treasure.x - halfW);
    expect(pos.x).toBeLessThanOrEqual(treasure.x + halfW);
    expect(pos.z).toBeGreaterThanOrEqual(treasure.z - halfD);
    expect(pos.z).toBeLessThanOrEqual(treasure.z + halfD);
  });
});

describe('layout traversability', () => {
  it('passage side walls span only the corridor gap between rooms', () => {
    const layout = generateLayout(42);
    for (const passage of layout.passages) {
      for (const wall of passage.walls) {
        expect(wall.length).toBeCloseTo(passage.corridorLength, 5);
      }
    }
  });

  it('every room is reachable from the start room for many seeds', { timeout: 15000 }, () => {
    for (let seed = 1; seed <= 25; seed++) {
      for (const profile of ['crowded', 'open']) {
        const layout = generateLayout(seed, profile);
        const colliders = buildWallColliders(layout);
        const aabbs = computeWalkableAABBs(layout);
        const reached = countReachableRooms(layout, aabbs, colliders);
        expect(reached).toBe(layout.rooms.length);
      }
    }
  });
});

describe('layout profiles', () => {
  it('uses deterministic seeds per quest id', () => {
    expect(questLayoutSeed('training_caverns')).toBe(questLayoutSeed('training_caverns'));
    expect(questLayoutSeed('training_caverns')).not.toBe(questLayoutSeed('crystal_rescue'));
  });

  it('crowded layouts have more rooms than open layouts on average', () => {
    let crowdedTotal = 0;
    let openTotal = 0;
    for (let seed = 1; seed <= 50; seed++) {
      crowdedTotal += generateLayout(seed, 'crowded').rooms.length;
      openTotal += generateLayout(seed, 'open').rooms.length;
    }
    expect(crowdedTotal / 50).toBeGreaterThan(openTotal / 50);
  });

  it('open layouts use wider passages and larger cell spacing', () => {
    const open = generateLayout(42, 'open');
    expect(open.passageWidth).toBe(LAYOUT_PROFILES.open.passageWidth);
    expect(open.cellSpacing).toBe(LAYOUT_PROFILES.open.cellSpacing);
    expect(open.profile).toBe('open');
  });
});

// ── Sloped floor corners ──

describe('floorCorners on rooms', () => {
  it('every room in a flat layout has floorCorners with all four corners at 0.5', () => {
    const layout = generateLayout(42);
    for (const room of layout.rooms) {
      expect(room.floorCorners).toBeDefined();
      expect(room.floorCorners.yNW).toBe(0.5);
      expect(room.floorCorners.yNE).toBe(0.5);
      expect(room.floorCorners.ySE).toBe(0.5);
      expect(room.floorCorners.ySW).toBe(0.5);
    }
  });

  it('flat layouts produced without slopes option are identical to default-call layouts', () => {
    const a = generateLayout(42);
    const b = generateLayout(42, undefined, {});
    expect(a).toEqual(b);
  });

  it('sloped layout has at least one room with differing corner heights', () => {
    const layout = generateLayout(42, undefined, { slopes: true });
    let hasSlope = false;
    for (const room of layout.rooms) {
      const { yNW, yNE, ySE, ySW } = room.floorCorners;
      const heights = new Set([yNW, yNE, ySE, ySW]);
      if (heights.size > 1) {
        hasSlope = true;
        break;
      }
    }
    expect(hasSlope).toBe(true);
  });

  it('sloped rooms have a southward ramp (north low, south high)', () => {
    const layout = generateLayout(42, undefined, { slopes: true });
    for (const room of layout.rooms) {
      const { yNW, yNE, ySE, ySW } = room.floorCorners;
      if (ySE !== yNW) {
        // This is a sloped room
        expect(yNW).toBe(0.5);
        expect(yNE).toBe(0.5);
        expect(ySE).toBe(2.0);
        expect(ySW).toBe(2.0);
      }
    }
  });

  it('start room (index 0) remains flat even with slopes enabled', () => {
    const layout = generateLayout(42, undefined, { slopes: true });
    const startRoom = layout.rooms[0];
    expect(startRoom.floorCorners.yNW).toBe(0.5);
    expect(startRoom.floorCorners.yNE).toBe(0.5);
    expect(startRoom.floorCorners.ySE).toBe(0.5);
    expect(startRoom.floorCorners.ySW).toBe(0.5);
  });

  it('sloped layout is deterministic: same seed produces identical output', () => {
    const a = generateLayout(42, undefined, { slopes: true });
    const b = generateLayout(42, undefined, { slopes: true });
    expect(a).toEqual(b);
  });

  it('sloped layout determinism across multiple seeds', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const a = generateLayout(seed, undefined, { slopes: true });
      const b = generateLayout(seed, undefined, { slopes: true });
      expect(a).toEqual(b);
    }
  });

  it('different seeds produce different sloped layouts', () => {
    const a = generateLayout(1, undefined, { slopes: true });
    const b = generateLayout(2, undefined, { slopes: true });
    // Compare floorCorners specifically
    let differs = false;
    for (let i = 0; i < Math.min(a.rooms.length, b.rooms.length); i++) {
      if (JSON.stringify(a.rooms[i].floorCorners) !== JSON.stringify(b.rooms[i].floorCorners)) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it('layouts without slopes flag have no regression vs layouts with slopes: false', () => {
    const noFlag = generateLayout(42);
    const explicitFalse = generateLayout(42, undefined, { slopes: false });
    expect(noFlag).toEqual(explicitFalse);
  });

  it('sloped layout preserves all existing room fields (x, z, width, depth, walls, role)', () => {
    const layout = generateLayout(42, undefined, { slopes: true });
    for (const room of layout.rooms) {
      expect(typeof room.x).toBe('number');
      expect(typeof room.z).toBe('number');
      expect(typeof room.width).toBe('number');
      expect(typeof room.depth).toBe('number');
      expect(Array.isArray(room.walls)).toBe(true);
      expect(['start', 'combat', 'treasure']).toContain(room.role);
    }
  });

  it('sloped layout has 1-2 ramp rooms (never 0, never more than 2)', () => {
    const layout = generateLayout(42, undefined, { slopes: true });
    let rampCount = 0;
    for (const room of layout.rooms) {
      const { yNW, ySE } = room.floorCorners;
      if (ySE !== yNW) rampCount++;
    }
    expect(rampCount).toBeGreaterThanOrEqual(1);
    expect(rampCount).toBeLessThanOrEqual(2);
  });

  it('sloped layout with crowded profile also produces ramps', () => {
    const layout = generateLayout(42, 'crowded', { slopes: true });
    let hasSlope = false;
    for (const room of layout.rooms) {
      const heights = new Set([
        room.floorCorners.yNW,
        room.floorCorners.yNE,
        room.floorCorners.ySE,
        room.floorCorners.ySW,
      ]);
      if (heights.size > 1) { hasSlope = true; break; }
    }
    expect(hasSlope).toBe(true);
  });
});

// ── sampleFloorY ──

describe('sampleFloorY(layout, x, z)', () => {
  it('returns DEFAULT_FLOOR_Y for any position inside a flat room', () => {
    const layout = generateLayout(1);
    const room = layout.rooms[0];
    // Room center
    expect(sampleFloorY(layout, room.x, room.z)).toBe(DEFAULT_FLOOR_Y);
    // Arbitrary interior point
    expect(sampleFloorY(layout, room.x + 3, room.z - 2)).toBe(DEFAULT_FLOOR_Y);
    // Edge of room (still inside bounds)
    expect(sampleFloorY(layout, room.x - room.width / 2, room.z)).toBe(DEFAULT_FLOOR_Y);
  });

  it('returns correct interpolated values at corners of a sloped room', () => {
    const layout = generateLayout(42, undefined, { slopes: true });
    // Find a sloped room
    const sloped = layout.rooms.find(r => r.floorCorners.ySE !== r.floorCorners.yNW);
    expect(sloped).toBeDefined();

    const halfW = sloped.width / 2;
    const halfD = sloped.depth / 2;

    // NW corner: x = room.x - halfW, z = room.z - halfD  → u=0, v=0
    expect(sampleFloorY(layout, sloped.x - halfW, sloped.z - halfD)).toBeCloseTo(sloped.floorCorners.yNW, 5);
    // NE corner: x = room.x + halfW, z = room.z - halfD  → u=1, v=0
    expect(sampleFloorY(layout, sloped.x + halfW, sloped.z - halfD)).toBeCloseTo(sloped.floorCorners.yNE, 5);
    // SE corner: x = room.x + halfW, z = room.z + halfD  → u=1, v=1
    expect(sampleFloorY(layout, sloped.x + halfW, sloped.z + halfD)).toBeCloseTo(sloped.floorCorners.ySE, 5);
    // SW corner: x = room.x - halfW, z = room.z + halfD  → u=0, v=1
    expect(sampleFloorY(layout, sloped.x - halfW, sloped.z + halfD)).toBeCloseTo(sloped.floorCorners.ySW, 5);
  });

  it('returns correct interpolated value at center of a sloped room', () => {
    const layout = generateLayout(42, undefined, { slopes: true });
    const sloped = layout.rooms.find(r => r.floorCorners.ySE !== r.floorCorners.yNW);
    expect(sloped).toBeDefined();

    // Center: u=0.5, v=0.5 → average of all four corners
    const center = sampleFloorY(layout, sloped.x, sloped.z);
    const expected =
      (sloped.floorCorners.yNW +
        sloped.floorCorners.yNE +
        sloped.floorCorners.ySE +
        sloped.floorCorners.ySW) /
      4;
    expect(center).toBeCloseTo(expected, 5);
  });

  it('returns null for positions outside all rooms', () => {
    const layout = generateLayout(42);
    // Far outside any room (rooms are within ~80 units of origin)
    expect(sampleFloorY(layout, 999, 999)).toBeNull();
    expect(sampleFloorY(layout, -999, -999)).toBeNull();
    // Between rooms (pick a spot midway between two non-adjacent rooms)
    const r0 = layout.rooms[0];
    const r1 = layout.rooms[layout.rooms.length - 1];
    const midX = (r0.x + r1.x) / 2;
    const midZ = (r0.z + r1.z) / 2;
    // This may or may not be inside a room, but at least one extreme should be null
    expect(sampleFloorY(layout, midX + 100, midZ + 100)).toBeNull();
  });

  it('returns DEFAULT_FLOOR_Y for room lacking floorCorners', () => {
    const layout = generateLayout(42);
    // Manually remove floorCorners from a room to test fallback
    const room = layout.rooms[0];
    const saved = room.floorCorners;
    delete room.floorCorners;
    expect(sampleFloorY(layout, room.x, room.z)).toBe(DEFAULT_FLOOR_Y);
    // Restore
    room.floorCorners = saved;
  });

  it('is deterministic: same layout produces same result', () => {
    const layout = generateLayout(42, undefined, { slopes: true });
    const a = sampleFloorY(layout, 10, 10);
    const b = sampleFloorY(layout, 10, 10);
    expect(a).toBe(b);
  });
});

describe('generateLayout(seed, "open-plaza")', () => {
  it('returns exactly one room and an empty passages array', () => {
    const layout = generateLayout(7, 'open-plaza');
    expect(layout.rooms).toHaveLength(1);
    expect(layout.passages).toEqual([]);
    expect(layout.profile).toBe('open-plaza');
  });

  it('plaza floor area is ≥ 4× the max default-profile room area (≥ 900 sq units)', () => {
    const layout = generateLayout(7, 'open-plaza');
    const [plaza] = layout.rooms;
    const area = plaza.width * plaza.depth;
    expect(area).toBeGreaterThanOrEqual(4 * MAX_ROOM_SIZE_INCLUSIVE * MAX_ROOM_SIZE_INCLUSIVE);
    expect(area).toBeGreaterThanOrEqual(900);
    expect(plaza.width).toBe(OPEN_PLAZA_SIZE);
    expect(plaza.depth).toBe(OPEN_PLAZA_SIZE);
  });

  it('has a continuous, gapless outer wall perimeter (one full-length wall per side)', () => {
    const [plaza] = generateLayout(7, 'open-plaza').rooms;
    // Four sides, each a single full-length segment → no passage gaps.
    expect(plaza.walls).toHaveLength(4);
    for (const wall of plaza.walls) {
      expect(wall.length).toBe(OPEN_PLAZA_SIZE);
    }
    const half = OPEN_PLAZA_SIZE / 2;
    const xWalls = plaza.walls.filter(w => w.axis === 'x').map(w => w.z).sort((a, b) => a - b);
    const zWalls = plaza.walls.filter(w => w.axis === 'z').map(w => w.x).sort((a, b) => a - b);
    expect(xWalls).toEqual([plaza.z - half, plaza.z + half]); // north + south
    expect(zWalls).toEqual([plaza.x - half, plaza.x + half]); // west + east
  });

  it('the single room is assigned role "start" so spawn lands on plaza centre', () => {
    const [plaza] = generateLayout(7, 'open-plaza').rooms;
    expect(plaza.role).toBe('start');
    expect(plaza.x).toBe(0);
    expect(plaza.z).toBe(0);
  });

  it('spawn helpers fall back to the plaza room when no combat/treasure room exists', () => {
    const layout = generateLayout(7, 'open-plaza');
    const [plaza] = layout.rooms;
    expect(roomsByRole(layout, 'combat')).toEqual([]);
    expect(roomsByRole(layout, 'treasure')).toEqual([]);
    const rng = mulberry32(123);
    for (let i = 0; i < 50; i++) {
      const pos = randomRoomPositionByRole(layout, 'combat', rng);
      expect(pos.x).toBeGreaterThanOrEqual(plaza.x - plaza.width / 2);
      expect(pos.x).toBeLessThanOrEqual(plaza.x + plaza.width / 2);
      expect(pos.z).toBeGreaterThanOrEqual(plaza.z - plaza.depth / 2);
      expect(pos.z).toBeLessThanOrEqual(plaza.z + plaza.depth / 2);
    }
  });

  it('is deterministic: same seed produces deep-equal layouts', () => {
    const a = generateLayout(99, 'open-plaza');
    const b = generateLayout(99, 'open-plaza');
    expect(a).toEqual(b);
  });

  it('is reachable end-to-end via getLayoutProfileForQuest()', () => {
    const profile = getLayoutProfileForQuest('open_plaza_trial');
    expect(profile).toBe('open-plaza');
    const layout = generateLayout(questLayoutSeed('open_plaza_trial'), profile);
    expect(layout.rooms).toHaveLength(1);
    expect(layout.rooms[0].role).toBe('start');
  });

  it('generateOpenPlaza() matches the generateLayout open-plaza branch', () => {
    expect(generateOpenPlaza(7)).toEqual(generateLayout(7, 'open-plaza'));
  });
});

// ── Open-plaza cover pieces + sloped platforms ──

describe('open-plaza cover pieces', () => {
  const SPAWN = { x: 0, z: 0 };
  const half = OPEN_PLAZA_SIZE / 2;

  function footprint(c, pad = 0) {
    return {
      minX: c.x - c.width / 2 - pad,
      maxX: c.x + c.width / 2 + pad,
      minZ: c.z - c.depth / 2 - pad,
      maxZ: c.z + c.depth / 2 + pad,
    };
  }
  function overlap(a, b) {
    return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
  }

  it('places at least 6 freestanding cover pieces', () => {
    const layout = generateLayout(7, 'open-plaza');
    expect(Array.isArray(layout.cover)).toBe(true);
    expect(layout.cover.length).toBeGreaterThanOrEqual(6);
    expect(layout.cover.length).toBeGreaterThanOrEqual(COVER_MIN);
  });

  it('each piece carries position, footprint, height and a recognised type', () => {
    const layout = generateLayout(7, 'open-plaza');
    for (const c of layout.cover) {
      expect(typeof c.x).toBe('number');
      expect(typeof c.z).toBe('number');
      expect(c.width).toBeGreaterThan(0);
      expect(c.depth).toBeGreaterThan(0);
      expect(c.height).toBeGreaterThan(0);
      expect(['pillar', 'brokenWall', 'planter']).toContain(c.type);
    }
  });

  it('every cover piece is fully inside the outer walls (no perimeter overlap)', () => {
    const layout = generateLayout(7, 'open-plaza');
    for (const c of layout.cover) {
      const f = footprint(c);
      expect(f.minX).toBeGreaterThan(-half);
      expect(f.maxX).toBeLessThan(half);
      expect(f.minZ).toBeGreaterThan(-half);
      expect(f.maxZ).toBeLessThan(half);
    }
  });

  it('cover pieces do not overlap each other', () => {
    const layout = generateLayout(7, 'open-plaza');
    for (let i = 0; i < layout.cover.length; i++) {
      for (let j = i + 1; j < layout.cover.length; j++) {
        expect(overlap(footprint(layout.cover[i]), footprint(layout.cover[j]))).toBe(false);
      }
    }
  });

  it('no cover piece overlaps the spawn point', () => {
    const layout = generateLayout(7, 'open-plaza');
    for (const c of layout.cover) {
      const f = footprint(c, PLAYER_RADIUS);
      const inside = SPAWN.x > f.minX && SPAWN.x < f.maxX && SPAWN.z > f.minZ && SPAWN.z < f.maxZ;
      expect(inside).toBe(false);
    }
  });

  it('spawn point is clear of every cover collider (server colliders)', () => {
    const layout = generateLayout(7, 'open-plaza');
    const colliders = buildWallColliders(layout);
    for (const c of layout.cover) {
      const a = {
        minX: c.x - c.width / 2,
        maxX: c.x + c.width / 2,
        minZ: c.z - c.depth / 2,
        maxZ: c.z + c.depth / 2,
      };
      const hit = SPAWN.x + PLAYER_RADIUS > a.minX && SPAWN.x - PLAYER_RADIUS < a.maxX &&
        SPAWN.z + PLAYER_RADIUS > a.minZ && SPAWN.z - PLAYER_RADIUS < a.maxZ;
      expect(hit).toBe(false);
    }
    // sanity: the colliders list actually contains entries
    expect(colliders.length).toBeGreaterThan(0);
  });

  it('at least 2 cover pieces sit on a gently sloped platform (delta ≈ 0.5, ≤ 0.6)', () => {
    const layout = generateLayout(7, 'open-plaza');
    const sloped = layout.cover.filter(c => c.platform);
    expect(sloped.length).toBeGreaterThanOrEqual(2);
    expect(sloped.length).toBeGreaterThanOrEqual(COVER_SLOPED);
    for (const c of sloped) {
      const { yNW, yNE, ySE, ySW } = c.platform.floorCorners;
      const heights = [yNW, yNE, ySE, ySW];
      const delta = Math.max(...heights) - Math.min(...heights);
      expect(delta).toBeLessThanOrEqual(0.6);
      expect(delta).toBeCloseTo(COVER_SLOPE_DELTA, 5);
    }
  });

  it('each sloped platform footprint is strictly larger than its cover footprint (apron ≥ 1.0 / ≥ 2×PLAYER_RADIUS per side)', () => {
    const layout = generateLayout(7, 'open-plaza');
    const sloped = layout.cover.filter(c => c.platform);
    expect(sloped.length).toBeGreaterThanOrEqual(COVER_SLOPED);
    expect(PLATFORM_APRON).toBeGreaterThanOrEqual(1.0);
    for (const c of sloped) {
      expect(c.platform.width).toBeGreaterThan(c.width);
      expect(c.platform.depth).toBeGreaterThan(c.depth);
      // Apron extends ≥ 1.0 (= 2×PLAYER_RADIUS) beyond the cover on each side.
      expect((c.platform.width - c.width) / 2).toBeGreaterThanOrEqual(1.0 - 1e-9);
      expect((c.platform.depth - c.depth) / 2).toBeGreaterThanOrEqual(1.0 - 1e-9);
      // Platform is centered on the cover (same x/z).
      expect(c.platform.floorCorners).toBeDefined();
    }
  });

  it('platform footprints stay inside the outer walls and clear of spawn and other platforms', () => {
    const layout = generateLayout(7, 'open-plaza');
    const spawnClear = { minX: SPAWN.x - 4, maxX: SPAWN.x + 4, minZ: SPAWN.z - 4, maxZ: SPAWN.z + 4 };
    for (const c of layout.cover) {
      const pb = platformBounds(c);
      // Inside the perimeter walls.
      expect(pb.minX).toBeGreaterThan(-half);
      expect(pb.maxX).toBeLessThan(half);
      expect(pb.minZ).toBeGreaterThan(-half);
      expect(pb.maxZ).toBeLessThan(half);
      // Clear of the spawn-clear zone.
      expect(overlap(pb, spawnClear)).toBe(false);
    }
    // No two platform footprints overlap each other.
    for (let i = 0; i < layout.cover.length; i++) {
      for (let j = i + 1; j < layout.cover.length; j++) {
        expect(overlap(platformBounds(layout.cover[i]), platformBounds(layout.cover[j]))).toBe(false);
      }
    }
  });

  it('the solid collider for a sloped piece still covers only the cover footprint (apron not blocked)', () => {
    const layout = generateLayout(7, 'open-plaza');
    const colliders = buildWallColliders(layout);
    for (const c of layout.cover.filter(p => p.platform)) {
      // The collider matching this piece equals the cover footprint, not the platform.
      const match = colliders.find(w =>
        Math.abs(w.minX - (c.x - c.width / 2)) < 1e-9 &&
        Math.abs(w.maxX - (c.x + c.width / 2)) < 1e-9 &&
        Math.abs(w.minZ - (c.z - c.depth / 2)) < 1e-9 &&
        Math.abs(w.maxZ - (c.z + c.depth / 2)) < 1e-9);
      expect(match).toBeDefined();
      // The collider is strictly smaller than the platform footprint.
      expect(match.maxX - match.minX).toBeLessThan(c.platform.width);
      expect(match.maxZ - match.minZ).toBeLessThan(c.platform.depth);
    }
  });

  it('an apron point (inside platform, outside cover) is walkable and rides up the slope (> DEFAULT_FLOOR_Y)', () => {
    const layout = generateLayout(7, 'open-plaza');
    const colliders = buildWallColliders(layout);
    const insideAny = (x, z, b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;

    const sloped = layout.cover.filter(c => c.platform);
    expect(sloped.length).toBeGreaterThanOrEqual(COVER_SLOPED);

    let checked = 0;
    for (const c of sloped) {
      // Pick a point on the raised (south) apron: just south of the solid cover
      // but still inside the platform footprint. The slope rises toward +z.
      const apronZ = c.z + c.depth / 2 + PLATFORM_APRON / 2;
      const apronX = c.x;
      // Inside the platform footprint…
      const pb = platformBounds(c);
      expect(insideAny(apronX, apronZ, pb)).toBe(true);
      // …but outside the solid cover footprint.
      const cb = { minX: c.x - c.width / 2, maxX: c.x + c.width / 2, minZ: c.z - c.depth / 2, maxZ: c.z + c.depth / 2 };
      expect(insideAny(apronX, apronZ, cb)).toBe(false);
      // (a) Not inside any wall/cover collider.
      const blocked = colliders.some(w => insideAny(apronX, apronZ, w));
      expect(blocked).toBe(false);
      // (b) sampleFloorY there is above the flat floor — a player rides the slope.
      const y = sampleFloorY(layout, apronX, apronZ);
      expect(y).toBeGreaterThan(DEFAULT_FLOOR_Y);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(COVER_SLOPED);
  });

  it('sampleFloorY returns DEFAULT_FLOOR_Y on the flat plaza away from any platform', () => {
    const layout = generateLayout(7, 'open-plaza');
    // The spawn point is kept clear of every platform, so it is flat floor.
    expect(sampleFloorY(layout, SPAWN.x, SPAWN.z)).toBe(DEFAULT_FLOOR_Y);
  });

  it('free-floor reachability is preserved (single connected region)', () => {
    const layout = generateLayout(7, 'open-plaza');
    expect(plazaFreeFloorConnected(OPEN_PLAZA_SIZE, layout.cover, SPAWN)).toBe(true);
  });

  it('free-floor reachability holds across many seeds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const layout = generateLayout(seed, 'open-plaza');
      expect(layout.cover.length).toBeGreaterThanOrEqual(6);
      expect(plazaFreeFloorConnected(OPEN_PLAZA_SIZE, layout.cover, SPAWN)).toBe(true);
    }
  });

  it('the wall-collider build includes one AABB per cover piece', () => {
    const layout = generateLayout(7, 'open-plaza');
    const withCover = buildWallColliders(layout);
    const withoutCover = buildWallColliders({ ...layout, cover: [] });
    expect(withCover.length - withoutCover.length).toBe(layout.cover.length);

    // Each cover footprint must appear as a collider.
    for (const c of layout.cover) {
      const match = withCover.some(w =>
        Math.abs(w.minX - (c.x - c.width / 2)) < 1e-9 &&
        Math.abs(w.maxX - (c.x + c.width / 2)) < 1e-9 &&
        Math.abs(w.minZ - (c.z - c.depth / 2)) < 1e-9 &&
        Math.abs(w.maxZ - (c.z + c.depth / 2)) < 1e-9);
      expect(match).toBe(true);
    }
  });

  it('is deterministic: same seed produces identical cover and slopes (deep-equal)', () => {
    const a = generateLayout(123, 'open-plaza');
    const b = generateLayout(123, 'open-plaza');
    expect(a.cover).toEqual(b.cover);
  });

  it('different seeds produce different cover placement', () => {
    const a = generateLayout(1, 'open-plaza');
    const b = generateLayout(2, 'open-plaza');
    expect(a.cover).not.toEqual(b.cover);
  });
});

describe('cover-aware spawn placement (open plaza)', () => {
  const COVER_PAD = 0.5; // matches dungeon PLAYER_RADIUS used by the guards

  // Inside the solid cover footprint — the "stuck inside a pillar" failure.
  function insideSolidCover(x, z, layout) {
    return layout.cover.some(c =>
      x > c.x - c.width / 2 && x < c.x + c.width / 2 &&
      z > c.z - c.depth / 2 && z < c.z + c.depth / 2);
  }

  // Inside the cover footprint inflated by the entity radius — the guarantee.
  function insideInflatedCover(x, z, layout, pad = COVER_PAD) {
    return layout.cover.some(c =>
      x > c.x - c.width / 2 - pad && x < c.x + c.width / 2 + pad &&
      z > c.z - c.depth / 2 - pad && z < c.z + c.depth / 2 + pad);
  }

  function withinPlazaFloor(x, z, layout) {
    const limit = layout.rooms[0].width / 2; // perimeter wall; samples stay well inside
    return x > -limit && x < limit && z > -limit && z < limit;
  }

  it('isInsideCover flags points inside a footprint and clears the spawn centre', () => {
    const layout = generateLayout(7, 'open-plaza');
    const piece = layout.cover[0];
    expect(isInsideCover(piece.x, piece.z, layout)).toBe(true);
    // Generation keeps the plaza centre (spawn) clear of cover.
    expect(isInsideCover(0, 0, layout)).toBe(false);
  });

  it('isInsideCover is a no-op on layouts without a cover array', () => {
    const layout = generateLayout(7, 'crowded');
    expect(layout.cover).toBeUndefined();
    for (const room of layout.rooms) {
      expect(isInsideCover(room.x, room.z, layout)).toBe(false);
    }
  });

  it('nudgeClearOfCover pushes a point out of cover while staying in the room', () => {
    const layout = generateLayout(7, 'open-plaza');
    const room = layout.rooms[0];
    const piece = layout.cover[0];
    const nudged = nudgeClearOfCover(piece.x, piece.z, layout, room);
    expect(isInsideCover(nudged.x, nudged.z, layout)).toBe(false);
    expect(withinPlazaFloor(nudged.x, nudged.z, layout)).toBe(true);
  });

  it('randomRoomPositionClearOfCover never lands inside cover across many draws', () => {
    const layout = generateLayout(7, 'open-plaza');
    const room = layout.rooms[0];
    const rng = mulberry32(99);
    for (let i = 0; i < 3000; i++) {
      const pos = randomRoomPositionClearOfCover(room, layout, rng);
      expect(insideSolidCover(pos.x, pos.z, layout)).toBe(false);
      expect(insideInflatedCover(pos.x, pos.z, layout)).toBe(false);
      expect(withinPlazaFloor(pos.x, pos.z, layout)).toBe(true);
    }
  });

  it('randomRoomPositionByRole yields only cover-clear positions on the plaza', () => {
    const layout = generateLayout(7, 'open-plaza');
    const rng = mulberry32(2024);
    for (let i = 0; i < 3000; i++) {
      // No 'combat' room on the plaza -> falls back to the single start room.
      const pos = randomRoomPositionByRole(layout, 'combat', rng);
      expect(insideInflatedCover(pos.x, pos.z, layout)).toBe(false);
      expect(withinPlazaFloor(pos.x, pos.z, layout)).toBe(true);
    }
  });

  it('is deterministic: same seed/layout yields identical cover-aware positions', () => {
    const layout = generateLayout(7, 'open-plaza');
    const room = layout.rooms[0];
    const a = mulberry32(555);
    const b = mulberry32(555);
    for (let i = 0; i < 200; i++) {
      expect(randomRoomPositionClearOfCover(room, layout, a))
        .toEqual(randomRoomPositionClearOfCover(room, layout, b));
    }
    const c = mulberry32(777);
    const d = mulberry32(777);
    for (let i = 0; i < 200; i++) {
      expect(randomRoomPositionByRole(layout, 'combat', c))
        .toEqual(randomRoomPositionByRole(layout, 'combat', d));
    }
  });

  it('cover-free layout: positions match the legacy sampler byte-for-byte', () => {
    const layout = generateLayout(7, 'crowded');
    const room = layout.rooms[1] || layout.rooms[0];
    const SPAWN_PADDING = 2;
    const rngActual = mulberry32(42);
    const rngExpected = mulberry32(42);
    const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
    const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
    for (let i = 0; i < 300; i++) {
      const actual = randomRoomPositionClearOfCover(room, layout, rngActual);
      const expected = {
        x: room.x + (rngExpected() * 2 - 1) * halfW,
        z: room.z + (rngExpected() * 2 - 1) * halfD,
      };
      expect(actual).toEqual(expected);
    }
  });

  it('cover-free layout: randomRoomPositionByRole matches the original implementation', () => {
    const layout = generateLayout(7, 'crowded');
    const SPAWN_PADDING = 2;
    const rngActual = mulberry32(13);
    const rngExpected = mulberry32(13);
    for (let i = 0; i < 300; i++) {
      const actual = randomRoomPositionByRole(layout, 'combat', rngActual);
      // Replicate the original: pick from the role/fallback pool, then sample.
      const matched = roomsByRole(layout, 'combat');
      const pool = matched.length > 0 ? matched : layout.rooms;
      const room = pool[Math.floor(rngExpected() * pool.length)];
      const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
      const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
      const expected = {
        x: room.x + (rngExpected() * 2 - 1) * halfW,
        z: room.z + (rngExpected() * 2 - 1) * halfD,
      };
      expect(actual).toEqual(expected);
    }
  });
});
