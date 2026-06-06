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
  sampleFloorY,
  sampleFloorSurface,
  questLayoutSeed,
  DEFAULT_FLOOR_Y,
  LAYOUT_PROFILES,
  DEFAULT_LAYOUT_PROFILE,
  normalizeLayoutProfile,
  GRID_COLS,
  GRID_ROWS,
  CELL_SPACING,
  MIN_ROOM_SIZE,
  MAX_ROOM_SIZE_INCLUSIVE,
  PASSAGE_WIDTH
} from '../dungeon.js';
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

  it("'default' string alias resolves to DEFAULT_LAYOUT_PROFILE, not crowded", () => {
    const normalized = normalizeLayoutProfile('default');
    expect(normalized.cellSpacing).toBe(DEFAULT_LAYOUT_PROFILE.cellSpacing);
    expect(normalized.cellSpacing).not.toBe(LAYOUT_PROFILES.crowded.cellSpacing);
    expect(normalized.targetRoomFraction).toBe(DEFAULT_LAYOUT_PROFILE.targetRoomFraction);

    const layout = generateLayout(42, 'default');
    expect(layout.profile).toBe('default');
    expect(layout.cellSpacing).toBe(DEFAULT_LAYOUT_PROFILE.cellSpacing);

    const crowded = generateLayout(42, 'crowded');
    expect(layout.cellSpacing).not.toBe(crowded.cellSpacing);
    expect(layout.rooms.length).not.toBe(crowded.rooms.length);
  });

  it('accepts DEFAULT_LAYOUT_PROFILE object unchanged', () => {
    const layout = generateLayout(42, DEFAULT_LAYOUT_PROFILE);
    expect(layout.profile).toBe('default');
    expect(layout.cellSpacing).toBe(DEFAULT_LAYOUT_PROFILE.cellSpacing);
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

// ── crowded interior cover ──

describe('crowded interior cover', () => {
  const SEED = 42;
  const MARGIN = 2;

  function combatRooms(layout) {
    return layout.rooms.filter(r => r.role === 'combat');
  }

  function coverInRoom(cover, room) {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    return cover.filter(c =>
      Math.abs(c.x - room.x) + c.width / 2 <= halfW + 1e-6 &&
      Math.abs(c.z - room.z) + c.depth / 2 <= halfD + 1e-6
    );
  }

  function roomReachability(room, cover) {
    const halfW = room.width / 2 - MARGIN;
    const halfD = room.depth / 2 - MARGIN;
    const step = 0.5;
    const cellsX = Math.floor((halfW * 2) / step);
    const cellsZ = Math.floor((halfD * 2) / step);
    const cellX = i => room.x - halfW + (i + 0.5) * step;
    const cellZ = j => room.z - halfD + (j + 0.5) * step;
    const blocked = (x, z) =>
      cover.some(c =>
        x >= c.x - c.width / 2 && x <= c.x + c.width / 2 &&
        z >= c.z - c.depth / 2 && z <= c.z + c.depth / 2
      );

    const startI = Math.floor(halfW / step);
    const startJ = Math.floor(halfD / step);
    const seen = new Set();
    const key = (i, j) => `${i},${j}`;
    const queue = [[startI, startJ]];
    seen.add(key(startI, startJ));
    while (queue.length) {
      const [i, j] = queue.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || ni >= cellsX || nj < 0 || nj >= cellsZ) continue;
        if (seen.has(key(ni, nj))) continue;
        if (blocked(cellX(ni), cellZ(nj))) continue;
        seen.add(key(ni, nj));
        queue.push([ni, nj]);
      }
    }

    let open = 0;
    for (let j = 0; j < cellsZ; j++) {
      for (let i = 0; i < cellsX; i++) {
        if (!blocked(cellX(i), cellZ(j))) open++;
      }
    }
    return seen.size === open;
  }

  it('generateLayout(seed, crowded) places ≥ 1 cover piece per combat room', () => {
    const layout = generateLayout(SEED, 'crowded');
    expect(Array.isArray(layout.cover)).toBe(true);
    const combat = combatRooms(layout);
    expect(combat.length).toBeGreaterThan(0);
    for (const room of combat) {
      expect(coverInRoom(layout.cover, room).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('cover pieces use pillar or broken_wall types and stay inside room margins', () => {
    const layout = generateLayout(SEED, 'crowded');
    for (const c of layout.cover) {
      expect(['pillar', 'broken_wall']).toContain(c.type);
      expect(c.height).toBeGreaterThan(0);
      const host = layout.rooms.find(r =>
        Math.abs(c.x - r.x) + c.width / 2 <= r.width / 2 + 1e-6 &&
        Math.abs(c.z - r.z) + c.depth / 2 <= r.depth / 2 + 1e-6
      );
      expect(host).toBeDefined();
      const halfW = host.width / 2 - MARGIN;
      const halfD = host.depth / 2 - MARGIN;
      expect(Math.abs(c.x - host.x) + c.width / 2).toBeLessThanOrEqual(halfW + 1e-6);
      expect(Math.abs(c.z - host.z) + c.depth / 2).toBeLessThanOrEqual(halfD + 1e-6);
    }
  });

  it('cover pieces do not overlap each other within a room', () => {
    const layout = generateLayout(SEED, 'crowded');
    for (const room of combatRooms(layout)) {
      const pieces = coverInRoom(layout.cover, room);
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          const a = pieces[i];
          const b = pieces[j];
          const overlap =
            Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 0.5 &&
            Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + 0.5;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it('every combat room stays fully reachable from its centre after cover placement', () => {
    for (const seed of [SEED, 1, 123, 777]) {
      const layout = generateLayout(seed, 'crowded');
      for (const room of combatRooms(layout)) {
        const pieces = coverInRoom(layout.cover, room);
        expect(roomReachability(room, pieces)).toBe(true);
      }
    }
  });

  it('cover footprints become wall colliders', () => {
    const layout = generateLayout(SEED, 'crowded');
    const colliders = buildWallColliders(layout);
    for (const c of layout.cover) {
      const hit = colliders.some(w =>
        Math.abs((w.minX + w.maxX) / 2 - c.x) < 1e-6 &&
        Math.abs((w.maxX - w.minX) - c.width) < 1e-6 &&
        Math.abs((w.minZ + w.maxZ) / 2 - c.z) < 1e-6 &&
        Math.abs((w.maxZ - w.minZ) - c.depth) < 1e-6
      );
      expect(hit).toBe(true);
    }
    const c0 = layout.cover[0];
    const collides = colliders.some(w =>
      c0.x + PLAYER_RADIUS > w.minX && c0.x - PLAYER_RADIUS < w.maxX &&
      c0.z + PLAYER_RADIUS > w.minZ && c0.z - PLAYER_RADIUS < w.maxZ
    );
    expect(collides).toBe(true);
  });

  it('sloped crowded layouts still generate valid cover in flat combat rooms', () => {
    const layout = generateLayout(SEED, 'crowded', { slopes: true });
    expect(layout.cover.length).toBeGreaterThan(0);
    for (const room of combatRooms(layout)) {
      const isSloped = new Set(Object.values(room.floorCorners)).size > 1;
      if (!isSloped) {
        expect(coverInRoom(layout.cover, room).length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = generateLayout(SEED, 'crowded');
    const b = generateLayout(SEED, 'crowded');
    expect(a.cover).toEqual(b.cover);
  });
});

// ── profile landmark props ──

describe('profile landmark props', () => {
  const SEED = 42;
  const CROWDED_TYPES = ['reactor_coil', 'pipe_stack'];
  const OPEN_TYPES = ['sand_spire', 'sun_arch'];

  function landmarkHostRoom(layout, lm) {
    return layout.rooms.find(r =>
      Math.abs(lm.x - r.x) <= r.width / 2 + 1e-6 &&
      Math.abs(lm.z - r.z) <= r.depth / 2 + 1e-6
    );
  }

  function footprintsOverlap(a, b, margin = 0) {
    return (
      Math.abs(a.x - b.x) < (a.width + b.width) / 2 + margin &&
      Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + margin
    );
  }

  function landmarkFootprint(lm) {
    const sizes = {
      reactor_coil: { width: 2.4, depth: 2.4 },
      pipe_stack: { width: 2.0, depth: 2.8 },
      sand_spire: { width: 2.2, depth: 2.2 },
      sun_arch: { width: 3.2, depth: 1.6 },
    };
    const fp = sizes[lm.type];
    return { x: lm.x, z: lm.z, width: fp.width, depth: fp.depth };
  }

  for (const [profile, allowed] of [['crowded', CROWDED_TYPES], ['open', OPEN_TYPES]]) {
    it(`generateLayout(seed, ${profile}) returns 1–2 landmarks with profile-specific types`, () => {
      const layout = generateLayout(SEED, profile);
      expect(Array.isArray(layout.landmarks)).toBe(true);
      expect(layout.landmarks.length).toBeGreaterThanOrEqual(1);
      expect(layout.landmarks.length).toBeLessThanOrEqual(2);
      for (const lm of layout.landmarks) {
        expect(allowed).toContain(lm.type);
        expect(typeof lm.x).toBe('number');
        expect(typeof lm.z).toBe('number');
      }
    });
  }

  it('landmarks are placed in non-start rooms and avoid cover footprints', () => {
    for (const profile of ['crowded', 'open']) {
      const layout = generateLayout(SEED, profile);
      for (const lm of layout.landmarks) {
        const host = landmarkHostRoom(layout, lm);
        expect(host).toBeDefined();
        expect(host.role).not.toBe('start');
        const fp = landmarkFootprint(lm);
        for (const c of layout.cover || []) {
          expect(footprintsOverlap(fp, c, 0.5)).toBe(false);
        }
      }
    }
  });

  it('landmark placement is deterministic for a fixed seed', () => {
    expect(generateLayout(SEED, 'crowded').landmarks).toEqual(
      generateLayout(SEED, 'crowded').landmarks
    );
    expect(generateLayout(SEED, 'open', { slopes: true }).landmarks).toEqual(
      generateLayout(SEED, 'open', { slopes: true }).landmarks
    );
  });
});

// ── open profile verticality & hazards ──

describe("generateLayout(seed, 'open') verticality & hazards", () => {
  const SEED = 42;
  const MARGIN = 2;
  const SPAWN_CLEAR = 5;

  function combatRooms(layout) {
    return layout.rooms.filter(r => r.role === 'combat');
  }

  function hostRoom(layout, fp) {
    return layout.rooms.find(r =>
      Math.abs(fp.x - r.x) + fp.width / 2 <= r.width / 2 + 1e-6 &&
      Math.abs(fp.z - r.z) + fp.depth / 2 <= r.depth / 2 + 1e-6
    );
  }

  function footprintInMargins(room, fp) {
    const halfW = room.width / 2 - MARGIN;
    const halfD = room.depth / 2 - MARGIN;
    return (
      Math.abs(fp.x - room.x) + fp.width / 2 <= halfW + 1e-6 &&
      Math.abs(fp.z - room.z) + fp.depth / 2 <= halfD + 1e-6
    );
  }

  it('with slopes places ≥ 1 platform in a non-start combat room', () => {
    const layout = generateLayout(SEED, 'open', { slopes: true });
    expect(Array.isArray(layout.platforms)).toBe(true);
    expect(layout.platforms.length).toBeGreaterThanOrEqual(1);
    const startRoom = layout.rooms.find(r => r.role === 'start');
    for (const p of layout.platforms) {
      expect(p.floorCorners).toBeDefined();
      const host = hostRoom(layout, p);
      expect(host).toBeDefined();
      expect(host.role).toBe('combat');
      expect(host).not.toBe(startRoom);
      const heights = [p.floorCorners.yNW, p.floorCorners.yNE, p.floorCorners.ySE, p.floorCorners.ySW];
      expect(Math.max(...heights) - DEFAULT_FLOOR_Y).toBeLessThanOrEqual(1.5);
    }
  });

  it('includes ≥ 1 pit hazard per layout inside a combat room', () => {
    const layout = generateLayout(SEED, 'open');
    expect(Array.isArray(layout.hazards)).toBe(true);
    expect(layout.hazards.length).toBeGreaterThanOrEqual(1);
    for (const h of layout.hazards) {
      expect(h.type).toBe('pit');
      expect(h.pitDepth).toBeGreaterThan(0);
      const host = hostRoom(layout, h);
      expect(host).toBeDefined();
      expect(host.role).toBe('combat');
      expect(footprintInMargins(host, h)).toBe(true);
      expect(Math.hypot(h.x - host.x, h.z - host.z)).toBeGreaterThanOrEqual(SPAWN_CLEAR - 0.01);
    }
  });

  it('scatters ≤ 2 cover pieces total (sparse vs crowded)', () => {
    const layout = generateLayout(SEED, 'open');
    expect(layout.cover.length).toBeLessThanOrEqual(2);
    const crowded = generateLayout(SEED, 'crowded');
    expect(crowded.cover.length).toBeGreaterThan(layout.cover.length);
  });

  it('with slopes applies ≥ 2 ramp rooms when room count allows', () => {
    const layout = generateLayout(SEED, 'open', { slopes: true });
    expect(layout.rooms.length).toBeGreaterThan(3);
    let rampCount = 0;
    for (const room of layout.rooms) {
      if (room.floorCorners.ySE !== room.floorCorners.yNW) rampCount++;
    }
    expect(rampCount).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic for a fixed seed', () => {
    const a = generateLayout(SEED, 'open', { slopes: true });
    const b = generateLayout(SEED, 'open', { slopes: true });
    expect(a.platforms).toEqual(b.platforms);
    expect(a.hazards).toEqual(b.hazards);
    expect(a.cover).toEqual(b.cover);
  });

  it('holds across multiple seeds', () => {
    for (const seed of [1, 7, 99, 2024]) {
      const layout = generateLayout(seed, 'open', { slopes: true });
      expect(layout.platforms.length).toBeGreaterThanOrEqual(1);
      expect(layout.hazards.length).toBeGreaterThanOrEqual(1);
      expect(layout.cover.length).toBeLessThanOrEqual(2);
    }
  });
});

// ── crowded rigid layoutMode ──

describe("generateLayout(seed, 'crowded') rigid layoutMode", () => {
  const RIGID_LANDMARK_TYPE = 'vault_dais';
  const MARGIN = 2;

  function combatRooms(layout) {
    return layout.rooms.filter(r => r.role === 'combat');
  }

  function coverInRoom(cover, room) {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    return cover.filter(c =>
      Math.abs(c.x - room.x) + c.width / 2 <= halfW + 1e-6 &&
      Math.abs(c.z - room.z) + c.depth / 2 <= halfD + 1e-6
    );
  }

  function roomReachability(room, cover) {
    const halfW = room.width / 2 - MARGIN;
    const halfD = room.depth / 2 - MARGIN;
    const step = 0.5;
    const cellsX = Math.floor((halfW * 2) / step);
    const cellsZ = Math.floor((halfD * 2) / step);
    const cellX = i => room.x - halfW + (i + 0.5) * step;
    const cellZ = j => room.z - halfD + (j + 0.5) * step;
    const blocked = (x, z) =>
      cover.some(c =>
        x >= c.x - c.width / 2 && x <= c.x + c.width / 2 &&
        z >= c.z - c.depth / 2 && z <= c.z + c.depth / 2
      );

    const startI = Math.floor(halfW / step);
    const startJ = Math.floor(halfD / step);
    const seen = new Set();
    const key = (i, j) => `${i},${j}`;
    const queue = [[startI, startJ]];
    seen.add(key(startI, startJ));
    while (queue.length) {
      const [i, j] = queue.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || ni >= cellsX || nj < 0 || nj >= cellsZ) continue;
        if (seen.has(key(ni, nj))) continue;
        if (blocked(cellX(ni), cellZ(nj))) continue;
        seen.add(key(ni, nj));
        queue.push([ni, nj]);
      }
    }

    let open = 0;
    for (let j = 0; j < cellsZ; j++) {
      for (let i = 0; i < cellsX; i++) {
        if (!blocked(cellX(i), cellZ(j))) open++;
      }
    }
    return seen.size === open;
  }

  function assertCrowdedRigidInvariants(layout) {
    expect(layout.profile).toBe('crowded');
    const combat = combatRooms(layout);
    expect(combat.length).toBeGreaterThan(0);
    for (const room of combat) {
      const isSloped = new Set(Object.values(room.floorCorners)).size > 1;
      if (isSloped) continue;
      expect(coverInRoom(layout.cover, room).length).toBeGreaterThanOrEqual(1);
      expect(roomReachability(room, coverInRoom(layout.cover, room))).toBe(true);
    }
    expect(layout.landmarks).toHaveLength(1);
    expect(layout.landmarks[0].type).toBe(RIGID_LANDMARK_TYPE);
  }

  function vaultDaisFootprint(lm) {
    return { x: lm.x, z: lm.z, width: 2.4, depth: 2.4 };
  }

  function landmarkHostRoom(layout, lm) {
    return layout.rooms.find(r =>
      Math.abs(lm.x - r.x) <= r.width / 2 + 1e-6 &&
      Math.abs(lm.z - r.z) <= r.depth / 2 + 1e-6
    );
  }

  function footprintsOverlap(a, b, margin = 0) {
    return (
      Math.abs(a.x - b.x) < (a.width + b.width) / 2 + margin &&
      Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + margin
    );
  }

  it('places exactly one vault_dais in the last sorted combat room (seed 123)', () => {
    const layout = generateLayout(123, 'crowded', { layoutMode: 'rigid' });
    expect(layout.landmarks).toHaveLength(1);
    const lm = layout.landmarks[0];
    expect(lm).toMatchObject({
      type: RIGID_LANDMARK_TYPE,
      yaw: 0,
    });
    expect(typeof lm.x).toBe('number');
    expect(typeof lm.z).toBe('number');

    const combatRooms = layout.rooms
      .filter(r => r.role === 'combat')
      .sort((a, b) => a.x - b.x || a.z - b.z);
    const hostRoom = combatRooms[combatRooms.length - 1];
    const landmarkRoom = landmarkHostRoom(layout, lm);
    expect(landmarkRoom).toBe(hostRoom);
    expect(landmarkRoom.role).toBe('combat');
    expect(landmarkRoom.role).not.toBe('start');

    const fp = vaultDaisFootprint(lm);
    for (const c of layout.cover) {
      expect(footprintsOverlap(fp, c, 0.5)).toBe(false);
    }
  });

  it('vault_dais placement is deterministic across seeds in rigid mode', () => {
    const ref = generateLayout(123, 'crowded', { layoutMode: 'rigid' }).landmarks;
    for (const seed of [1, 42, 777, 9999]) {
      expect(generateLayout(seed, 'crowded', { layoutMode: 'rigid' }).landmarks).toEqual(ref);
    }
  });

  it('default crowded layouts still use decorative reactor_coil and pipe_stack only', () => {
    const layout = generateLayout(123, 'crowded', { layoutMode: 'default' });
    const decorativeTypes = ['reactor_coil', 'pipe_stack'];
    expect(layout.landmarks.length).toBeGreaterThanOrEqual(1);
    for (const lm of layout.landmarks) {
      expect(decorativeTypes).toContain(lm.type);
    }
  });

  it('unknown layoutMode values fall back to default scatter behavior', () => {
    const withDefault = generateLayout(123, 'crowded', { layoutMode: 'default' });
    const withUnknown = generateLayout(123, 'crowded', { layoutMode: 'chaotic' });
    expect(withUnknown.cover).toEqual(withDefault.cover);
    expect(withUnknown.landmarks).toEqual(withDefault.landmarks);
  });

  it('rigid mode produces identical rooms/passages and dressing across different seeds', () => {
    const seeds = [1, 42, 123, 777, 9999];
    const layouts = seeds.map((seed) =>
      generateLayout(seed, 'crowded', { slopes: true, layoutMode: 'rigid' })
    );
    for (let i = 1; i < layouts.length; i++) {
      expect(layouts[i].rooms).toEqual(layouts[0].rooms);
      expect(layouts[i].passages).toEqual(layouts[0].passages);
      expect(layouts[i].cover).toEqual(layouts[0].cover);
      expect(layouts[i].landmarks).toEqual(layouts[0].landmarks);
    }
  });

  it('rigid mode still satisfies crowded structural and reachability assertions', () => {
    assertCrowdedRigidInvariants(
      generateLayout(123, 'crowded', { slopes: true, layoutMode: 'rigid' })
    );
  });

  it('default mode still varies cover across a seed sweep', () => {
    const ref = generateLayout(1, 'crowded', { layoutMode: 'default' });
    let foundDifference = false;
    for (let seed = 2; seed <= 100; seed++) {
      const other = generateLayout(seed, 'crowded', { layoutMode: 'default' });
      if (JSON.stringify(ref.cover) !== JSON.stringify(other.cover)) {
        foundDifference = true;
        break;
      }
    }
    expect(foundDifference).toBe(true);
  });

  it('rigid and default modes can diverge for the same seed', () => {
    const rigid = generateLayout(123, 'crowded', { layoutMode: 'rigid' });
    const def = generateLayout(123, 'crowded', { layoutMode: 'default' });
    const rigidAgain = generateLayout(9999, 'crowded', { layoutMode: 'rigid' });
    expect(rigid.rooms).toEqual(rigidAgain.rooms);
    expect(rigid.cover).toEqual(rigidAgain.cover);
    const differs =
      JSON.stringify(rigid.rooms) !== JSON.stringify(def.rooms) ||
      JSON.stringify(rigid.cover) !== JSON.stringify(def.cover);
    expect(differs).toBe(true);
  });
});

// ── open rigid layoutMode ──

describe("generateLayout(seed, 'open') rigid layoutMode", () => {
  const OPEN_TYPES = ['sand_spire', 'sun_arch'];
  const MARGIN = 2;
  const SPAWN_CLEAR = 5;

  function combatRooms(layout) {
    return layout.rooms.filter(r => r.role === 'combat');
  }

  function hostRoom(layout, fp) {
    return layout.rooms.find(r =>
      Math.abs(fp.x - r.x) + fp.width / 2 <= r.width / 2 + 1e-6 &&
      Math.abs(fp.z - r.z) + fp.depth / 2 <= r.depth / 2 + 1e-6
    );
  }

  function assertOpenRigidInvariants(layout) {
    expect(layout.profile).toBe('open');
    expect(layout.platforms.length).toBeGreaterThanOrEqual(1);
    expect(layout.hazards.length).toBeGreaterThanOrEqual(1);
    expect(layout.cover.length).toBeLessThanOrEqual(2);
    for (const p of layout.platforms) {
      const host = hostRoom(layout, p);
      expect(host).toBeDefined();
      expect(host.role).toBe('combat');
    }
    for (const h of layout.hazards) {
      expect(h.type).toBe('pit');
      const host = hostRoom(layout, h);
      expect(host).toBeDefined();
      expect(host.role).toBe('combat');
      expect(Math.hypot(h.x - host.x, h.z - host.z)).toBeGreaterThanOrEqual(SPAWN_CLEAR - 0.01);
    }
    expect(layout.landmarks.length).toBeGreaterThanOrEqual(1);
    for (const lm of layout.landmarks) {
      expect(OPEN_TYPES).toContain(lm.type);
    }
  }

  it('unknown layoutMode values fall back to default scatter behavior', () => {
    const withDefault = generateLayout(123, 'open', { layoutMode: 'default', slopes: true });
    const withUnknown = generateLayout(123, 'open', { layoutMode: 'chaotic', slopes: true });
    expect(withUnknown.cover).toEqual(withDefault.cover);
    expect(withUnknown.hazards).toEqual(withDefault.hazards);
    expect(withUnknown.platforms).toEqual(withDefault.platforms);
  });

  it('rigid mode produces identical rooms/passages and dressing across different seeds', () => {
    const seeds = [1, 42, 123, 777, 9999];
    const layouts = seeds.map((seed) =>
      generateLayout(seed, 'open', { slopes: true, layoutMode: 'rigid' })
    );
    for (let i = 1; i < layouts.length; i++) {
      expect(layouts[i].rooms).toEqual(layouts[0].rooms);
      expect(layouts[i].passages).toEqual(layouts[0].passages);
      expect(layouts[i].cover).toEqual(layouts[0].cover);
      expect(layouts[i].landmarks).toEqual(layouts[0].landmarks);
      expect(layouts[i].platforms).toEqual(layouts[0].platforms);
      expect(layouts[i].hazards).toEqual(layouts[0].hazards);
    }
  });

  it('rigid mode still satisfies open structural assertions', () => {
    assertOpenRigidInvariants(
      generateLayout(123, 'open', { slopes: true, layoutMode: 'rigid' })
    );
  });

  it('default mode still varies cover or hazards across a seed sweep', () => {
    const ref = generateLayout(1, 'open', { layoutMode: 'default', slopes: true });
    let foundDifference = false;
    for (let seed = 2; seed <= 100; seed++) {
      const other = generateLayout(seed, 'open', { layoutMode: 'default', slopes: true });
      if (
        JSON.stringify(ref.cover) !== JSON.stringify(other.cover) ||
        JSON.stringify(ref.hazards) !== JSON.stringify(other.hazards)
      ) {
        foundDifference = true;
        break;
      }
    }
    expect(foundDifference).toBe(true);
  });

  it('rigid and default modes can diverge for the same seed', () => {
    const rigid = generateLayout(123, 'open', { slopes: true, layoutMode: 'rigid' });
    const def = generateLayout(123, 'open', { slopes: true, layoutMode: 'default' });
    const rigidAgain = generateLayout(9999, 'open', { slopes: true, layoutMode: 'rigid' });
    expect(rigid.platforms).toEqual(rigidAgain.platforms);
    expect(rigid.hazards).toEqual(rigidAgain.hazards);
    const differs =
      JSON.stringify(rigid.rooms) !== JSON.stringify(def.rooms) ||
      JSON.stringify(rigid.hazards) !== JSON.stringify(def.hazards) ||
      JSON.stringify(rigid.cover) !== JSON.stringify(def.cover);
    expect(differs).toBe(true);
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

// ── open-plaza arena layout ──

describe("generateLayout(seed, 'open-plaza')", () => {
  const PLAYER_RADIUS_PLAZA = 0.5;

  // Flood-fill reachability over the plaza interior using the cover colliders.
  // Returns the set of cover pieces whose footprint centre is reachable from
  // the plaza centre, plus whether every open interior cell was reached.
  function plazaReachability(layout) {
    const plaza = layout.rooms[0];
    const half = plaza.width / 2;
    const step = 0.5;
    const cells = Math.floor((half * 2) / step);
    const cellCentre = i => -half + (i + 0.5) * step;
    const blocked = (x, z) =>
      layout.cover.some(c =>
        x >= c.x - c.width / 2 && x <= c.x + c.width / 2 &&
        z >= c.z - c.depth / 2 && z <= c.z + c.depth / 2
      );

    const startI = Math.floor(half / step);
    const seen = new Set();
    const key = (i, j) => `${i},${j}`;
    const queue = [[startI, startI]];
    seen.add(key(startI, startI));
    while (queue.length) {
      const [i, j] = queue.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || ni >= cells || nj < 0 || nj >= cells) continue;
        if (seen.has(key(ni, nj))) continue;
        if (blocked(cellCentre(ni), cellCentre(nj))) continue;
        seen.add(key(ni, nj));
        queue.push([ni, nj]);
      }
    }

    let open = 0;
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        if (!blocked(cellCentre(i), cellCentre(j))) open++;
      }
    }
    return { allReachable: seen.size === open };
  }

  it('produces the right shape: one start room, empty passages, profile open-plaza', () => {
    const layout = generateLayout(123, 'open-plaza');
    expect(layout.profile).toBe('open-plaza');
    expect(layout.rooms.length).toBe(1);
    expect(layout.rooms[0].role).toBe('start');
    expect(layout.rooms[0].walls.length).toBe(4); // four solid perimeter walls
    expect(layout.passages).toEqual([]);
  });

  it('plaza walkable area is ≥ 4× a default room (~182 units²)', () => {
    const layout = generateLayout(123, 'open-plaza');
    const plaza = layout.rooms[0];
    const area = plaza.width * plaza.depth;
    expect(area).toBeGreaterThanOrEqual(4 * 182);
  });

  const OPEN_PLAZA_COVER_TYPES = ['pillar', 'broken_wall', 'barricade', 'crate_stack'];

  it('has ≥ 6 cover pieces of valid type, fully inside the interior', () => {
    const layout = generateLayout(123, 'open-plaza');
    expect(layout.cover.length).toBeGreaterThanOrEqual(6);
    const half = layout.rooms[0].width / 2;
    for (const c of layout.cover) {
      expect(OPEN_PLAZA_COVER_TYPES).toContain(c.type);
      expect(Math.abs(c.x) + c.width / 2).toBeLessThanOrEqual(half);
      expect(Math.abs(c.z) + c.depth / 2).toBeLessThanOrEqual(half);
    }
  });

  it('uses ≥ 3 distinct cover types and includes every candidate-pool type for seed 123', () => {
    const layout = generateLayout(123, 'open-plaza');
    const typesInLayout = new Set(layout.cover.map(c => c.type));
    expect(typesInLayout.size).toBeGreaterThanOrEqual(3);
    for (const type of OPEN_PLAZA_COVER_TYPES) {
      expect(typesInLayout.has(type)).toBe(true);
    }
  });

  it('has ≥ 3 platforms at distinct positions, each with corner delta ≤ 0.5', () => {
    const layout = generateLayout(123, 'open-plaza');
    expect(layout.platforms.length).toBeGreaterThanOrEqual(3);
    const positions = layout.platforms.map(p => `${p.x},${p.z}`);
    expect(new Set(positions).size).toBe(layout.platforms.length);
    for (const p of layout.platforms) {
      const ys = [p.floorCorners.yNW, p.floorCorners.yNE, p.floorCorners.ySE, p.floorCorners.ySW];
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('places ≥ 2 cover pieces over a platform', () => {
    const layout = generateLayout(123, 'open-plaza');
    const onPlatform = layout.cover.filter(c =>
      layout.platforms.some(p =>
        Math.abs(c.x - p.x) <= p.width / 2 && Math.abs(c.z - p.z) <= p.depth / 2
      )
    );
    expect(onPlatform.length).toBeGreaterThanOrEqual(2);
  });

  it('cover does not overlap the spawn-clear zone around plaza centre', () => {
    const layout = generateLayout(123, 'open-plaza');
    const RADIUS = 6;
    for (const c of layout.cover) {
      const dx = Math.max(Math.abs(c.x) - c.width / 2, 0);
      const dz = Math.max(Math.abs(c.z) - c.depth / 2, 0);
      expect(dx * dx + dz * dz).toBeGreaterThanOrEqual(RADIUS * RADIUS);
    }
  });

  it('includes ≥ 1 pit hazard outside spawn-clear and clear of cover footprints', () => {
    const layout = generateLayout(123, 'open-plaza');
    const SPAWN_CLEAR = 6;
    expect(Array.isArray(layout.hazards)).toBe(true);
    expect(layout.hazards.length).toBeGreaterThanOrEqual(1);
    for (const h of layout.hazards) {
      expect(h.type).toBe('pit');
      expect(h.pitDepth).toBeGreaterThan(0);
      const dx = Math.max(Math.abs(h.x) - h.width / 2, 0);
      const dz = Math.max(Math.abs(h.z) - h.depth / 2, 0);
      expect(dx * dx + dz * dz).toBeGreaterThanOrEqual(SPAWN_CLEAR * SPAWN_CLEAR);
      const hitsCover = layout.cover.some(c => {
        const margin = 0.5;
        return (
          Math.abs(h.x - c.x) < (h.width + c.width) / 2 + margin &&
          Math.abs(h.z - c.z) < (h.depth + c.depth) / 2 + margin
        );
      });
      expect(hitsCover).toBe(false);
    }
  });

  it('hazards do not add wall colliders or change sampleFloorY at pit centres', () => {
    const layout = generateLayout(123, 'open-plaza');
    const colliders = buildWallColliders(layout);
    for (const h of layout.hazards) {
      const hit = colliders.some(w =>
        Math.abs((w.minX + w.maxX) / 2 - h.x) < 1e-6 &&
        Math.abs((w.maxX - w.minX) - h.width) < 1e-6
      );
      expect(hit).toBe(false);
      expect(sampleFloorY(layout, h.x, h.z)).toBe(DEFAULT_FLOOR_Y);
    }
  });

  it('cover never blocks reachability: every interior cell stays reachable from centre', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = generateLayout(seed, 'open-plaza');
      const { allReachable } = plazaReachability(layout);
      expect(allReachable).toBe(true);
    }
  });

  it('sampleFloorY returns raised height on a platform and DEFAULT_FLOOR_Y elsewhere', () => {
    const layout = generateLayout(123, 'open-plaza');
    const p = layout.platforms[0];
    expect(sampleFloorY(layout, p.x, p.z)).toBeGreaterThanOrEqual(DEFAULT_FLOOR_Y + 1.0);
    for (const platform of layout.platforms) {
      const corners = platform.floorCorners;
      const maxCorner = Math.max(corners.yNW, corners.yNE, corners.ySE, corners.ySW);
      expect(maxCorner).toBeGreaterThanOrEqual(DEFAULT_FLOOR_Y + 1.0);
      expect(sampleFloorY(layout, platform.x, platform.z)).toBeGreaterThanOrEqual(DEFAULT_FLOOR_Y + 1.0);
    }
    // A point on the open plaza floor away from any platform reads the flat floor.
    expect(sampleFloorY(layout, 0, 0)).toBe(DEFAULT_FLOOR_Y);
  });

  it('is deterministic: same seed yields deep-equal layouts', () => {
    const a = generateLayout(2024, 'open-plaza');
    const b = generateLayout(2024, 'open-plaza');
    expect(a).toEqual(b);
  });

  it('returns exactly one arena_dais landmark at the origin', () => {
    const layout = generateLayout(123, 'open-plaza');
    expect(layout.landmarks).toEqual([{ x: 0, z: 0, type: 'arena_dais' }]);
  });

  it('includes a center_ring floor marking inside the spawn-clear radius', () => {
    const layout = generateLayout(123, 'open-plaza');
    expect(Array.isArray(layout.floorMarkings)).toBe(true);
    expect(layout.floorMarkings.length).toBeGreaterThanOrEqual(1);
    const ring = layout.floorMarkings.find(m => m.type === 'center_ring');
    expect(ring).toBeDefined();
    expect(ring.x).toBe(0);
    expect(ring.z).toBe(0);
    expect(ring.innerRadius).toBeGreaterThan(0);
    expect(ring.outerRadius).toBeGreaterThan(ring.innerRadius);
    const spawnClearRadius = 6;
    expect(ring.outerRadius).toBeLessThanOrEqual(spawnClearRadius);
    const maxExtent = Math.hypot(ring.x, ring.z) + ring.outerRadius;
    expect(maxExtent).toBeLessThanOrEqual(spawnClearRadius);
  });

  it('floor markings do not affect wall colliders or sampleFloorY at origin', () => {
    const layout = generateLayout(123, 'open-plaza');
    const withMarkings = buildWallColliders(layout);
    const withoutMarkings = buildWallColliders({ ...layout, floorMarkings: [] });
    expect(withMarkings).toEqual(withoutMarkings);
    expect(sampleFloorY(layout, 0, 0)).toBe(DEFAULT_FLOOR_Y);
    expect(sampleFloorY({ ...layout, floorMarkings: [] }, 0, 0)).toBe(DEFAULT_FLOOR_Y);
  });

  it('landmarks do not affect wall colliders', () => {
    const layout = generateLayout(123, 'open-plaza');
    const withLandmark = buildWallColliders(layout);
    const withoutLandmark = buildWallColliders({ ...layout, landmarks: [] });
    expect(withLandmark).toEqual(withoutLandmark);
  });

  it('includes ≥ 8 perimeter decor entries of allowed types, ≥ 2 per wall, inside interior margin', () => {
    const layout = generateLayout(123, 'open-plaza');
    const half = layout.rooms[0].width / 2;
    const margin = 2;
    const allowed = ['arena_banner', 'arena_tier'];
    const walls = ['north', 'south', 'east', 'west'];

    expect(Array.isArray(layout.perimeterDecor)).toBe(true);
    expect(layout.perimeterDecor.length).toBeGreaterThanOrEqual(8);

    for (const d of layout.perimeterDecor) {
      expect(allowed).toContain(d.type);
      expect(walls).toContain(d.wall);
      expect(Math.abs(d.x)).toBeLessThanOrEqual(half - margin);
      expect(Math.abs(d.z)).toBeLessThanOrEqual(half - margin);
    }

    for (const wall of walls) {
      const onWall = layout.perimeterDecor.filter(d => d.wall === wall);
      expect(onWall.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('perimeter decor does not affect wall colliders or wall gaps', () => {
    const layout = generateLayout(123, 'open-plaza');
    const withDecor = buildWallColliders(layout);
    const withoutDecor = buildWallColliders({ ...layout, perimeterDecor: [] });
    expect(withDecor).toEqual(withoutDecor);
    expect(layout.rooms[0].walls.length).toBe(4);
  });

  it('cover footprints become wall colliders (player cannot walk through cover)', () => {
    const layout = generateLayout(123, 'open-plaza');
    const colliders = buildWallColliders(layout);
    for (const c of layout.cover) {
      const hit = colliders.some(w =>
        Math.abs((w.minX + w.maxX) / 2 - c.x) < 1e-6 &&
        Math.abs((w.maxX - w.minX) - c.width) < 1e-6 &&
        Math.abs((w.minZ + w.maxZ) / 2 - c.z) < 1e-6 &&
        Math.abs((w.maxZ - w.minZ) - c.depth) < 1e-6
      );
      expect(hit).toBe(true);
    }
    // A player standing at the centre of a cover footprint collides.
    const c0 = layout.cover[0];
    const collides = colliders.some(w =>
      c0.x + PLAYER_RADIUS_PLAZA > w.minX && c0.x - PLAYER_RADIUS_PLAZA < w.maxX &&
      c0.z + PLAYER_RADIUS_PLAZA > w.minZ && c0.z - PLAYER_RADIUS_PLAZA < w.maxZ
    );
    expect(collides).toBe(true);
  });
});

// ── open-plaza rigid layoutMode ──

describe("generateLayout(seed, 'open-plaza') rigid layoutMode", () => {
  it('unknown layoutMode values fall back to default scatter behavior', () => {
    const withDefault = generateLayout(123, 'open-plaza', { layoutMode: 'default' });
    const withUnknown = generateLayout(123, 'open-plaza', { layoutMode: 'chaotic' });
    expect(withUnknown.cover).toEqual(withDefault.cover);
    expect(withUnknown.hazards).toEqual(withDefault.hazards);
  });

  it('rigid mode is deterministic for the same seed', () => {
    const a = generateLayout(42, 'open-plaza', { layoutMode: 'rigid' });
    const b = generateLayout(42, 'open-plaza', { layoutMode: 'rigid' });
    expect(a).toEqual(b);
    expect(a.cover).toEqual(b.cover);
    expect(a.hazards).toEqual(b.hazards);
  });

  it('rigid mode produces identical cover/hazards across different seeds', () => {
    const seeds = [1, 42, 123, 777, 9999];
    const layouts = seeds.map((seed) =>
      generateLayout(seed, 'open-plaza', { layoutMode: 'rigid' })
    );
    for (let i = 1; i < layouts.length; i++) {
      expect(layouts[i].cover).toEqual(layouts[0].cover);
      expect(layouts[i].hazards).toEqual(layouts[0].hazards);
    }
  });

  it('default mode still varies cover or hazards with seed', () => {
    const ref = generateLayout(1, 'open-plaza', { layoutMode: 'default' });
    let foundDifference = false;
    for (let seed = 2; seed <= 100; seed++) {
      const other = generateLayout(seed, 'open-plaza', { layoutMode: 'default' });
      if (
        JSON.stringify(ref.cover) !== JSON.stringify(other.cover) ||
        JSON.stringify(ref.hazards) !== JSON.stringify(other.hazards)
      ) {
        foundDifference = true;
        break;
      }
    }
    expect(foundDifference).toBe(true);
  });

  it('rigid and default modes can diverge for the same seed', () => {
    const rigid = generateLayout(123, 'open-plaza', { layoutMode: 'rigid' });
    const def = generateLayout(123, 'open-plaza', { layoutMode: 'default' });
    const rigidAgain = generateLayout(9999, 'open-plaza', { layoutMode: 'rigid' });
    expect(rigid.cover).toEqual(rigidAgain.cover);
    expect(rigid.hazards).toEqual(rigidAgain.hazards);
    const coverDiffers =
      JSON.stringify(rigid.cover) !== JSON.stringify(def.cover) ||
      JSON.stringify(rigid.hazards) !== JSON.stringify(def.hazards);
    expect(coverDiffers).toBe(true);
  });

  it('rigid mode still satisfies open-plaza structural requirements', () => {
    const layout = generateLayout(123, 'open-plaza', { layoutMode: 'rigid' });
    expect(layout.cover.length).toBeGreaterThanOrEqual(6);
    expect(layout.hazards.length).toBeGreaterThanOrEqual(1);
    expect(layout.platforms.length).toBeGreaterThanOrEqual(3);
  });
});

// ── sunken-canyon stage layout ──

describe("generateLayout(seed, 'sunken-canyon')", () => {
  function roomsByBand(layout, band) {
    return layout.rooms.filter(r => r.band === band);
  }

  function isFlatAtY(room, y) {
    const fc = room.floorCorners;
    return fc.yNW === y && fc.yNE === y && fc.ySE === y && fc.ySW === y;
  }

  function rampAverageSlope(room) {
    const fc = room.floorCorners;
    const yHigh = Math.max(fc.yNW, fc.yNE, fc.ySE, fc.ySW);
    const yLow = Math.min(fc.yNW, fc.yNE, fc.ySE, fc.ySW);
    const rise = yHigh - yLow;
    const run = (fc.yNW === fc.yNE && fc.ySE === fc.ySW) ? room.depth : room.width;
    return rise / run;
  }

  function canyonReachableFromPlateau(layout) {
    const colliders = buildWallColliders(layout);
    const aabbs = computeWalkableAABBs(layout);
    return countReachableRooms(layout, aabbs, colliders) === layout.rooms.length;
  }

  it('returns profile sunken-canyon with plateau, ramps, and canyon bands', () => {
    const layout = generateLayout(42, 'sunken-canyon');
    expect(layout.profile).toBe('sunken-canyon');
    expect(layout.passages).toEqual([]);
    expect(roomsByBand(layout, 'plateau').length).toBe(1);
    expect(roomsByBand(layout, 'canyon').length).toBe(1);
    const ramps = roomsByBand(layout, 'ramp');
    expect(ramps.length).toBeGreaterThanOrEqual(4);
    expect(ramps.length).toBeLessThanOrEqual(5);
  });

  it('has a flat plateau (~12–15 units) and a canyon floor ≥ 4× default room area', () => {
    const layout = generateLayout(42, 'sunken-canyon');
    const plateau = roomsByBand(layout, 'plateau')[0];
    const canyon = roomsByBand(layout, 'canyon')[0];
    expect(plateau.width).toBeGreaterThanOrEqual(12);
    expect(plateau.width).toBeLessThanOrEqual(15);
    expect(plateau.depth).toBeGreaterThanOrEqual(12);
    expect(plateau.depth).toBeLessThanOrEqual(15);
    expect(canyon.width * canyon.depth).toBeGreaterThanOrEqual(4 * 182);
    expect(isFlatAtY(plateau, sampleFloorY(layout, plateau.x, plateau.z))).toBe(true);
    expect(isFlatAtY(canyon, sampleFloorY(layout, canyon.x, canyon.z))).toBe(true);
  });

  it('Y drop from plateau centre to canyon centre is ≥ 8 units', () => {
    for (const seed of [1, 42, 123, 777]) {
      const layout = generateLayout(seed, 'sunken-canyon');
      const plateau = roomsByBand(layout, 'plateau')[0];
      const canyon = roomsByBand(layout, 'canyon')[0];
      const yPlateau = sampleFloorY(layout, plateau.x, plateau.z);
      const yCanyon = sampleFloorY(layout, canyon.x, canyon.z);
      expect(yPlateau - yCanyon).toBeGreaterThanOrEqual(8);
    }
  });

  it('each ramp has non-uniform corners and average slope ≥ 0.15', () => {
    for (const seed of [1, 42, 999]) {
      const layout = generateLayout(seed, 'sunken-canyon');
      for (const ramp of roomsByBand(layout, 'ramp')) {
        const fc = ramp.floorCorners;
        const corners = [fc.yNW, fc.yNE, fc.ySE, fc.ySW];
        expect(new Set(corners).size).toBeGreaterThan(1);
        expect(rampAverageSlope(ramp)).toBeGreaterThanOrEqual(0.15);
      }
    }
  });

  it('assigns explicit roles: plateau=start, canyon=treasure, ramps=connector spawnWeight 0', () => {
    const layout = generateLayout(42, 'sunken-canyon');
    const plateau = roomsByBand(layout, 'plateau')[0];
    const canyon = roomsByBand(layout, 'canyon')[0];
    expect(plateau.role).toBe('start');
    expect(canyon.role).toBe('treasure');
    for (const ramp of roomsByBand(layout, 'ramp')) {
      expect(ramp.role).toBe('connector');
      expect(ramp.spawnWeight).toBe(0);
    }
  });

  it('has ≥ 6 canyon cover pieces of valid type inside the canyon interior', () => {
    const layout = generateLayout(42, 'sunken-canyon');
    const canyon = roomsByBand(layout, 'canyon')[0];
    const half = canyon.width / 2;
    expect(layout.cover.length).toBeGreaterThanOrEqual(6);
    for (const c of layout.cover) {
      expect(['pillar', 'broken_wall']).toContain(c.type);
      expect(Math.abs(c.x - canyon.x) + c.width / 2).toBeLessThanOrEqual(half);
      expect(Math.abs(c.z - canyon.z) + c.depth / 2).toBeLessThanOrEqual(half);
    }
  });

  it('plateau and canyon have solid outer perimeter walls (no walk-off gaps)', () => {
    const layout = generateLayout(42, 'sunken-canyon');
    const plateau = roomsByBand(layout, 'plateau')[0];
    const canyon = roomsByBand(layout, 'canyon')[0];
    const ph = plateau.depth / 2;
    const pw = plateau.width / 2;
    const ch = canyon.depth / 2;
    const cw = canyon.width / 2;

    // Plateau north, west, east edges are fully walled.
    expect(plateau.walls.some(w => w.axis === 'x' && Math.abs(w.z - (plateau.z - ph)) < 0.01 && Math.abs(w.length - plateau.width) < 0.01)).toBe(true);
    expect(plateau.walls.some(w => w.axis === 'z' && Math.abs(w.x - (plateau.x - pw)) < 0.01)).toBe(true);
    expect(plateau.walls.some(w => w.axis === 'z' && Math.abs(w.x - (plateau.x + pw)) < 0.01)).toBe(true);

    // Canyon south, west, east edges are fully walled.
    expect(canyon.walls.some(w => w.axis === 'x' && Math.abs(w.z - (canyon.z + ch)) < 0.01 && Math.abs(w.length - canyon.width) < 0.01)).toBe(true);
    expect(canyon.walls.some(w => w.axis === 'z' && Math.abs(w.x - (canyon.x - cw)) < 0.01)).toBe(true);
    expect(canyon.walls.some(w => w.axis === 'z' && Math.abs(w.x - (canyon.x + cw)) < 0.01)).toBe(true);
  });

  it('full foot reachability from plateau spawn to canyon floor via ramps', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = generateLayout(seed, 'sunken-canyon');
      expect(canyonReachableFromPlateau(layout)).toBe(true);
    }
  });

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

  function canyonLateralEdgeProbes(canyon) {
    const inset = 2;
    const halfW = canyon.width / 2;
    const northZ = canyon.z - canyon.depth / 2 + inset;
    return [
      { x: canyon.x + (halfW - inset), z: northZ },
      { x: canyon.x - (halfW - inset), z: northZ },
    ];
  }

  function edgeRampCenters(layout) {
    const canyon = roomsByBand(layout, 'canyon')[0];
    const ramp = roomsByBand(layout, 'ramp')[0];
    const canyonHalf = canyon.width / 2;
    const rampHalfW = ramp.width / 2;
    const edgeRampX = canyonHalf - 2 - rampHalfW;
    return [-edgeRampX, edgeRampX];
  }

  function edgeRampForProbe(canyon, edgeRampCentersList, probeX) {
    const [westX, eastX] = edgeRampCentersList;
    return probeX >= canyon.x ? eastX : westX;
  }

  it('plateau spawn can reach canyon treasure room center via walkable AABBs', () => {
    for (const seed of [1, 42, 123, 777]) {
      const layout = generateLayout(seed, 'sunken-canyon');
      const plateau = roomsByBand(layout, 'plateau')[0];
      const canyon = roomsByBand(layout, 'canyon')[0];
      const colliders = buildWallColliders(layout);
      const aabbs = computeWalkableAABBs(layout);
      expect(canReachPoint(plateau.x, plateau.z, canyon.x, canyon.z, aabbs, colliders)).toBe(true);
    }
  });

  it('plateau and canyon lateral-edge probes are bidirectionally walkable', () => {
    for (const seed of [1, 42, 123, 777]) {
      const layout = generateLayout(seed, 'sunken-canyon');
      const plateau = roomsByBand(layout, 'plateau')[0];
      const canyon = roomsByBand(layout, 'canyon')[0];
      const rampZ = roomsByBand(layout, 'ramp')[0].z;
      const edgeRamps = edgeRampCenters(layout);
      const colliders = buildWallColliders(layout);
      const aabbs = computeWalkableAABBs(layout);
      for (const probe of canyonLateralEdgeProbes(canyon)) {
        const edgeRampX = edgeRampForProbe(canyon, edgeRamps, probe.x);
        expect(canReachPoint(probe.x, probe.z, plateau.x, plateau.z, aabbs, colliders)).toBe(true);
        expect(canReachPoint(plateau.x, plateau.z, probe.x, probe.z, aabbs, colliders)).toBe(true);
        expect(canReachPoint(probe.x, probe.z, edgeRampX, rampZ, aabbs, colliders)).toBe(true);
        expect(canReachPoint(edgeRampX, rampZ, plateau.x, plateau.z, aabbs, colliders)).toBe(true);
      }
    }
  });

  it('cover footprints become wall colliders', () => {
    const layout = generateLayout(42, 'sunken-canyon');
    const colliders = buildWallColliders(layout);
    for (const c of layout.cover) {
      const hit = colliders.some(w =>
        Math.abs((w.minX + w.maxX) / 2 - c.x) < 1e-6 &&
        Math.abs((w.maxX - w.minX) - c.width) < 1e-6 &&
        Math.abs((w.minZ + w.maxZ) / 2 - c.z) < 1e-6 &&
        Math.abs((w.maxZ - w.minZ) - c.depth) < 1e-6
      );
      expect(hit).toBe(true);
    }
  });

  it('is deterministic: same seed yields deep-equal layouts', () => {
    const a = generateLayout(2024, 'sunken-canyon');
    const b = generateLayout(2024, 'sunken-canyon');
    expect(a).toEqual(b);
  });

  it('ramp count is 4–5 across many seeds (2 edge connectors + 2–3 central)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const layout = generateLayout(seed, 'sunken-canyon');
      const rampCount = roomsByBand(layout, 'ramp').length;
      expect(rampCount).toBeGreaterThanOrEqual(4);
      expect(rampCount).toBeLessThanOrEqual(5);
    }
  });

  it('emits one cliffLip per ramp at plateau high Y, aligned to ramp X centres', () => {
    for (const seed of [1, 42, 123, 777]) {
      const layout = generateLayout(seed, 'sunken-canyon');
      const ramps = roomsByBand(layout, 'ramp');
      const plateau = roomsByBand(layout, 'plateau')[0];
      const yPlateau = sampleFloorY(layout, plateau.x, plateau.z);

      expect(Array.isArray(layout.cliffLips)).toBe(true);
      expect(layout.cliffLips.length).toBe(ramps.length);
      expect(layout.cliffLips.length).toBeGreaterThanOrEqual(4);
      expect(layout.cliffLips.length).toBeLessThanOrEqual(5);

      for (const ramp of ramps) {
        const lip = layout.cliffLips.find(
          (l) => Math.abs((l.minX + l.maxX) / 2 - ramp.x) < 0.01
        );
        expect(lip).toBeDefined();
        expect(lip.y).toBe(yPlateau);
        expect(lip.maxX - lip.minX).toBeCloseTo(ramp.width, 4);
        const rampHalfD = ramp.depth / 2;
        const rampNorthZ = ramp.z - rampHalfD;
        expect(lip.maxZ).toBeLessThanOrEqual(rampNorthZ - 0.01);
      }
    }
  });

  function monolithFootprint(lm) {
    return { x: lm.x, z: lm.z, width: 2.0, depth: 2.0 };
  }

  function footprintsOverlap(a, b, margin = 0) {
    return (
      Math.abs(a.x - b.x) < (a.width + b.width) / 2 + margin &&
      Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + margin
    );
  }

  function outsideSpawnClear(lm, canyon, radius = 6) {
    const fp = monolithFootprint(lm);
    const dx = Math.max(Math.abs(fp.x - canyon.x) - fp.width / 2, 0);
    const dz = Math.max(Math.abs(fp.z - canyon.z) - fp.depth / 2, 0);
    return dx * dx + dz * dz >= radius * radius;
  }

  it('places exactly one canyon_monolith landmark in the canyon band (seed 42)', () => {
    const layout = generateLayout(42, 'sunken-canyon');
    const canyon = roomsByBand(layout, 'canyon')[0];
    expect(layout.landmarks).toHaveLength(1);
    const lm = layout.landmarks[0];
    expect(lm.type).toBe('canyon_monolith');
    expect(typeof lm.x).toBe('number');
    expect(typeof lm.z).toBe('number');
    expect(typeof lm.yaw).toBe('number');
    expect(Math.abs(lm.x - canyon.x) + monolithFootprint(lm).width / 2).toBeLessThanOrEqual(canyon.width / 2);
    expect(Math.abs(lm.z - canyon.z) + monolithFootprint(lm).depth / 2).toBeLessThanOrEqual(canyon.depth / 2);
    expect(outsideSpawnClear(lm, canyon)).toBe(true);
    const fp = monolithFootprint(lm);
    for (const c of layout.cover) {
      expect(footprintsOverlap(fp, c, 0.5)).toBe(false);
    }
    const floorY = sampleFloorY(layout, lm.x, lm.z);
    expect(floorY).toBeCloseTo(sampleFloorY(layout, canyon.x, canyon.z), 4);
  });

  it('canyon monolith placement is deterministic for seed 42', () => {
    expect(generateLayout(42, 'sunken-canyon').landmarks).toEqual(
      generateLayout(42, 'sunken-canyon').landmarks
    );
  });

  it('emits edgeHazards along plateau south rim between ramp mouths', () => {
    for (const seed of [1, 42, 123, 777]) {
      const layout = generateLayout(seed, 'sunken-canyon');
      const plateau = roomsByBand(layout, 'plateau')[0];
      const ramps = roomsByBand(layout, 'ramp');
      const yPlateau = sampleFloorY(layout, plateau.x, plateau.z);
      const plateauSouthZ = plateau.z + plateau.depth / 2;

      expect(Array.isArray(layout.edgeHazards)).toBe(true);
      expect(layout.edgeHazards.length).toBeGreaterThanOrEqual(1);

      for (const hazard of layout.edgeHazards) {
        expect(hazard).toMatchObject({
          minX: expect.any(Number),
          maxX: expect.any(Number),
          minZ: expect.any(Number),
          maxZ: expect.any(Number),
          y: yPlateau,
          side: expect.stringMatching(/^(south|west|east)$/),
          band: 'plateau',
        });
        expect(hazard.maxX - hazard.minX).toBeGreaterThan(0);
        expect(hazard.maxZ - hazard.minZ).toBeGreaterThan(0);

        if (hazard.side === 'south') {
          expect(hazard.maxZ).toBeCloseTo(plateauSouthZ, 4);
          expect(hazard.maxZ - hazard.minZ).toBeLessThanOrEqual(1.5);
          for (const ramp of ramps) {
            const rampCenterX = ramp.x;
            const rampHalfW = ramp.width / 2;
            const hazardCenterX = (hazard.minX + hazard.maxX) / 2;
            const overlapsRampMouth =
              hazardCenterX > rampCenterX - rampHalfW - 0.01 &&
              hazardCenterX < rampCenterX + rampHalfW + 0.01;
            expect(overlapsRampMouth).toBe(false);
          }
        }
      }
    }
  });

  it('plateau cliff hazards do not reduce canyon reachability', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = generateLayout(seed, 'sunken-canyon');
      expect(layout.edgeHazards.length).toBeGreaterThanOrEqual(1);
      expect(canyonReachableFromPlateau(layout)).toBe(true);
    }
  });

  describe('rigid layoutMode', () => {
    it('unknown layoutMode values fall back to default scatter behavior', () => {
      const withDefault = generateLayout(123, 'sunken-canyon', { layoutMode: 'default' });
      const withUnknown = generateLayout(123, 'sunken-canyon', { layoutMode: 'chaotic' });
      expect(withUnknown.rooms).toEqual(withDefault.rooms);
      expect(withUnknown.cover).toEqual(withDefault.cover);
      expect(withUnknown.landmarks).toEqual(withDefault.landmarks);
    });

    it('rigid mode produces identical structural fields across different seeds', () => {
      const seeds = [1, 42, 123, 777, 9999];
      const layouts = seeds.map((seed) =>
        generateLayout(seed, 'sunken-canyon', { layoutMode: 'rigid' })
      );
      for (let i = 1; i < layouts.length; i++) {
        expect(layouts[i].rooms).toEqual(layouts[0].rooms);
        expect(layouts[i].cover).toEqual(layouts[0].cover);
        expect(layouts[i].landmarks).toEqual(layouts[0].landmarks);
        expect(layouts[i].cliffLips).toEqual(layouts[0].cliffLips);
        expect(layouts[i].edgeHazards).toEqual(layouts[0].edgeHazards);
      }
    });

    it('rigid mode still satisfies sunken-canyon structural and reachability assertions', () => {
      const layout = generateLayout(123, 'sunken-canyon', { layoutMode: 'rigid' });
      expect(layout.profile).toBe('sunken-canyon');

      const ramps = roomsByBand(layout, 'ramp');
      expect(ramps.length).toBe(5);

      const plateau = roomsByBand(layout, 'plateau')[0];
      const canyon = roomsByBand(layout, 'canyon')[0];
      expect(plateau.role).toBe('start');
      expect(canyon.role).toBe('treasure');
      for (const ramp of ramps) {
        expect(ramp.role).toBe('connector');
        expect(ramp.spawnWeight).toBe(0);
      }

      expect(layout.cover.length).toBeGreaterThanOrEqual(6);
      expect(layout.landmarks).toHaveLength(1);
      expect(layout.landmarks[0].type).toBe('canyon_monolith');
      expect(outsideSpawnClear(layout.landmarks[0], canyon)).toBe(true);

      expect(layout.cliffLips.length).toBe(ramps.length);
      expect(layout.edgeHazards.length).toBeGreaterThanOrEqual(1);
      expect(canyonReachableFromPlateau(layout)).toBe(true);
    });

    it('default mode still varies ramp count across seeds', () => {
      const rampCounts = new Set();
      for (let seed = 1; seed <= 30; seed++) {
        const layout = generateLayout(seed, 'sunken-canyon', { layoutMode: 'default' });
        rampCounts.add(roomsByBand(layout, 'ramp').length);
      }
      expect(rampCounts.has(4)).toBe(true);
      expect(rampCounts.has(5)).toBe(true);
    });

    it('rigid and default modes can diverge for the same seed', () => {
      const rigid = generateLayout(123, 'sunken-canyon', { layoutMode: 'rigid' });
      const def = generateLayout(123, 'sunken-canyon', { layoutMode: 'default' });
      const rigidAgain = generateLayout(9999, 'sunken-canyon', { layoutMode: 'rigid' });
      expect(rigid.rooms).toEqual(rigidAgain.rooms);
      expect(rigid.cover).toEqual(rigidAgain.cover);
      expect(rigid.landmarks).toEqual(rigidAgain.landmarks);
      const geometryDiffers =
        JSON.stringify(rigid.rooms) !== JSON.stringify(def.rooms) ||
        JSON.stringify(rigid.cover) !== JSON.stringify(def.cover) ||
        JSON.stringify(rigid.landmarks) !== JSON.stringify(def.landmarks);
      expect(geometryDiffers).toBe(true);
    });
  });
});

// ── ice-cavern stage layout ──

describe("generateLayout(seed, 'ice-cavern')", () => {
  function roomsByBand(layout, band) {
    return layout.rooms.filter(r => r.band === band);
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

  it('returns profile ice-cavern with stone, ice, and ramp bands', () => {
    const layout = generateLayout(42, 'ice-cavern');
    expect(layout.profile).toBe('ice-cavern');
    expect(layout.passages).toEqual([]);
    expect(roomsByBand(layout, 'stone').length).toBe(2);
    expect(roomsByBand(layout, 'ice').length).toBe(1);
    const ramps = roomsByBand(layout, 'ramp');
    expect(ramps.length).toBeGreaterThanOrEqual(1);
    expect(ramps.length).toBeLessThanOrEqual(2);
  });

  it('tags slippery ice field ≥ 4× default room area and normal stone pads', () => {
    const layout = generateLayout(42, 'ice-cavern');
    const ice = roomsByBand(layout, 'ice')[0];
    const stoneRooms = roomsByBand(layout, 'stone');
    expect(ice.width * ice.depth).toBeGreaterThanOrEqual(4 * 182);
    expect(ice.floorSurface).toBe('slippery');
    expect(sampleFloorSurface(layout, ice.x, ice.z)).toBe('slippery');
    for (const stone of stoneRooms) {
      expect(stone.floorSurface).toBe('normal');
      expect(sampleFloorSurface(layout, stone.x, stone.z)).toBe('normal');
    }
    for (const ramp of roomsByBand(layout, 'ramp')) {
      expect(ramp.floorSurface).toBe('normal');
    }
  });

  it('assigns explicit roles: stone start, stone treasure, ramps=connector', () => {
    const layout = generateLayout(42, 'ice-cavern');
    const start = layout.rooms.find(r => r.role === 'start');
    const treasure = layout.rooms.find(r => r.role === 'treasure');
    expect(start.band).toBe('stone');
    expect(treasure.band).toBe('stone');
    for (const ramp of roomsByBand(layout, 'ramp')) {
      expect(ramp.role).toBe('connector');
      expect(ramp.spawnWeight).toBe(0);
    }
  });

  it('start spawn can reach treasure room center via walkable AABBs', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = generateLayout(seed, 'ice-cavern');
      const start = layout.rooms.find(r => r.role === 'start');
      const treasure = layout.rooms.find(r => r.role === 'treasure');
      const colliders = buildWallColliders(layout);
      const aabbs = computeWalkableAABBs(layout);
      expect(canReachPoint(start.x, start.z, treasure.x, treasure.z, aabbs, colliders)).toBe(true);
    }
  });

  it('is deterministic: same seed yields deep-equal layouts', () => {
    const a = generateLayout(2024, 'ice-cavern');
    const b = generateLayout(2024, 'ice-cavern');
    expect(a).toEqual(b);
  });

  it('places cover only on stone pads, not on the ice field', () => {
    const layout = generateLayout(42, 'ice-cavern');
    const ice = roomsByBand(layout, 'ice')[0];
    const half = ice.width / 2;
    for (const c of layout.cover) {
      const onIce =
        Math.abs(c.x - ice.x) + c.width / 2 <= half &&
        Math.abs(c.z - ice.z) + c.depth / 2 <= half;
      expect(onIce).toBe(false);
    }
  });
});

// ── fire-cavern stage layout ──

describe("generateLayout(seed, 'fire-cavern')", () => {
  function roomsByBand(layout, band) {
    return layout.rooms.filter(r => r.band === band);
  }

  function isFlatAtY(room, y) {
    const fc = room.floorCorners;
    return fc.yNW === y && fc.yNE === y && fc.ySE === y && fc.ySW === y;
  }

  function rampAverageSlope(room) {
    const fc = room.floorCorners;
    const yHigh = Math.max(fc.yNW, fc.yNE, fc.ySE, fc.ySW);
    const yLow = Math.min(fc.yNW, fc.yNE, fc.ySE, fc.ySW);
    const rise = yHigh - yLow;
    const run = (fc.yNW === fc.yNE && fc.ySE === fc.ySW) ? room.depth : room.width;
    return rise / run;
  }

  function basinReachableFromRim(layout) {
    const colliders = buildWallColliders(layout);
    const aabbs = computeWalkableAABBs(layout);
    return countReachableRooms(layout, aabbs, colliders) === layout.rooms.length;
  }

  it('returns profile fire-cavern with rim, ramps, and basin bands', () => {
    const layout = generateLayout(42, 'fire-cavern');
    expect(layout.profile).toBe('fire-cavern');
    expect(layout.passages).toEqual([]);
    expect(roomsByBand(layout, 'rim').length).toBe(1);
    expect(roomsByBand(layout, 'basin').length).toBe(1);
    const ramps = roomsByBand(layout, 'ramp');
    expect(ramps.length).toBeGreaterThanOrEqual(2);
    expect(ramps.length).toBeLessThanOrEqual(3);
  });

  it('has a flat rim (~12–15 units) and a basin floor ≥ 4× default room area', () => {
    const layout = generateLayout(42, 'fire-cavern');
    const rim = roomsByBand(layout, 'rim')[0];
    const basin = roomsByBand(layout, 'basin')[0];
    expect(rim.width).toBeGreaterThanOrEqual(12);
    expect(rim.width).toBeLessThanOrEqual(15);
    expect(rim.depth).toBeGreaterThanOrEqual(12);
    expect(rim.depth).toBeLessThanOrEqual(15);
    expect(basin.width * basin.depth).toBeGreaterThanOrEqual(4 * 182);
    expect(isFlatAtY(rim, sampleFloorY(layout, rim.x, rim.z))).toBe(true);
    expect(isFlatAtY(basin, sampleFloorY(layout, basin.x, basin.z))).toBe(true);
  });

  it('Y drop from rim centre to basin centre is ≥ 8 units', () => {
    for (const seed of [1, 42, 123, 777]) {
      const layout = generateLayout(seed, 'fire-cavern');
      const rim = roomsByBand(layout, 'rim')[0];
      const basin = roomsByBand(layout, 'basin')[0];
      const yRim = sampleFloorY(layout, rim.x, rim.z);
      const yBasin = sampleFloorY(layout, basin.x, basin.z);
      expect(yRim - yBasin).toBeGreaterThanOrEqual(8);
    }
  });

  it('each ramp has non-uniform corners and average slope ≥ 0.15', () => {
    for (const seed of [1, 42, 999]) {
      const layout = generateLayout(seed, 'fire-cavern');
      for (const ramp of roomsByBand(layout, 'ramp')) {
        const fc = ramp.floorCorners;
        const corners = [fc.yNW, fc.yNE, fc.ySE, fc.ySW];
        expect(new Set(corners).size).toBeGreaterThan(1);
        expect(rampAverageSlope(ramp)).toBeGreaterThanOrEqual(0.15);
      }
    }
  });

  it('assigns explicit roles: rim=start, basin=treasure, ramps=connector spawnWeight 0', () => {
    const layout = generateLayout(42, 'fire-cavern');
    const rim = roomsByBand(layout, 'rim')[0];
    const basin = roomsByBand(layout, 'basin')[0];
    expect(rim.role).toBe('start');
    expect(basin.role).toBe('treasure');
    for (const ramp of roomsByBand(layout, 'ramp')) {
      expect(ramp.role).toBe('connector');
      expect(ramp.spawnWeight).toBe(0);
    }
  });

  it('has ≥ 6 basin cover pieces of valid type inside the basin interior', () => {
    const layout = generateLayout(42, 'fire-cavern');
    const basin = roomsByBand(layout, 'basin')[0];
    const half = basin.width / 2;
    expect(layout.cover.length).toBeGreaterThanOrEqual(6);
    for (const c of layout.cover) {
      expect(['pillar', 'broken_wall']).toContain(c.type);
      expect(Math.abs(c.x - basin.x) + c.width / 2).toBeLessThanOrEqual(half);
      expect(Math.abs(c.z - basin.z) + c.depth / 2).toBeLessThanOrEqual(half);
    }
  });

  it('rim and basin have solid outer perimeter walls (no walk-off gaps)', () => {
    const layout = generateLayout(42, 'fire-cavern');
    const rim = roomsByBand(layout, 'rim')[0];
    const basin = roomsByBand(layout, 'basin')[0];
    const rh = rim.depth / 2;
    const rw = rim.width / 2;
    const bh = basin.depth / 2;
    const bw = basin.width / 2;

    expect(rim.walls.some(w => w.axis === 'x' && Math.abs(w.z - (rim.z - rh)) < 0.01 && Math.abs(w.length - rim.width) < 0.01)).toBe(true);
    expect(rim.walls.some(w => w.axis === 'z' && Math.abs(w.x - (rim.x - rw)) < 0.01)).toBe(true);
    expect(rim.walls.some(w => w.axis === 'z' && Math.abs(w.x - (rim.x + rw)) < 0.01)).toBe(true);

    expect(basin.walls.some(w => w.axis === 'x' && Math.abs(w.z - (basin.z + bh)) < 0.01 && Math.abs(w.length - basin.width) < 0.01)).toBe(true);
    expect(basin.walls.some(w => w.axis === 'z' && Math.abs(w.x - (basin.x - bw)) < 0.01)).toBe(true);
    expect(basin.walls.some(w => w.axis === 'z' && Math.abs(w.x - (basin.x + bw)) < 0.01)).toBe(true);
  });

  it('full foot reachability from rim spawn to basin floor via ramps', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = generateLayout(seed, 'fire-cavern');
      expect(basinReachableFromRim(layout)).toBe(true);
    }
  });

  it('is deterministic: same seed yields deep-equal layouts', () => {
    const a = generateLayout(2024, 'fire-cavern');
    const b = generateLayout(2024, 'fire-cavern');
    expect(a).toEqual(b);
  });

  it('ramp count is 2–3 across many seeds', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const layout = generateLayout(seed, 'fire-cavern');
      const rampCount = roomsByBand(layout, 'ramp').length;
      expect(rampCount).toBeGreaterThanOrEqual(2);
      expect(rampCount).toBeLessThanOrEqual(3);
    }
  });
});
// ── spire-ascent stage layout ──

describe("generateLayout(seed, 'spire-ascent')", () => {
  function roomsByBand(layout, band) {
    return layout.rooms.filter(r => r.band === band);
  }

  function isFlatAtY(room, y) {
    const fc = room.floorCorners;
    return fc.yNW === y && fc.yNE === y && fc.ySE === y && fc.ySW === y;
  }

  function rampAverageSlope(room) {
    const fc = room.floorCorners;
    const yHigh = Math.max(fc.yNW, fc.yNE, fc.ySE, fc.ySW);
    const yLow = Math.min(fc.yNW, fc.yNE, fc.ySE, fc.ySW);
    const rise = yHigh - yLow;
    const run = (fc.yNW === fc.yNE && fc.ySE === fc.ySW) ? room.depth : room.width;
    return rise / run;
  }

  function spireReachableFromStart(layout) {
    const colliders = buildWallColliders(layout);
    const aabbs = computeWalkableAABBs(layout);
    return countReachableRooms(layout, aabbs, colliders) === layout.rooms.length;
  }

  function tiersByIndex(layout) {
    return roomsByBand(layout, 'tier').sort((a, b) => a.tierIndex - b.tierIndex);
  }

  it('returns profile spire-ascent with tier and ramp bands', () => {
    const layout = generateLayout(42, 'spire-ascent');
    expect(layout.profile).toBe('spire-ascent');
    expect(layout.passages).toEqual([]);
    const tiers = roomsByBand(layout, 'tier');
    expect(tiers.length).toBeGreaterThanOrEqual(3);
    expect(tiers.length).toBeLessThanOrEqual(5);
    expect(roomsByBand(layout, 'ramp').length).toBe(tiers.length - 1);
  });

  it('tier count is 3–5 and ramp count equals tierCount − 1', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const layout = generateLayout(seed, 'spire-ascent');
      const tierCount = roomsByBand(layout, 'tier').length;
      expect(tierCount).toBeGreaterThanOrEqual(3);
      expect(tierCount).toBeLessThanOrEqual(5);
      expect(roomsByBand(layout, 'ramp').length).toBe(tierCount - 1);
    }
  });

  it('each tier is room-sized (~12–15) with flat floorCorners', () => {
    const layout = generateLayout(42, 'spire-ascent');
    for (const tier of roomsByBand(layout, 'tier')) {
      expect(tier.width).toBeGreaterThanOrEqual(12);
      expect(tier.width).toBeLessThanOrEqual(15);
      expect(tier.depth).toBeGreaterThanOrEqual(12);
      expect(tier.depth).toBeLessThanOrEqual(15);
      const y = sampleFloorY(layout, tier.x, tier.z);
      expect(isFlatAtY(tier, y)).toBe(true);
    }
  });

  it('tier floor Y increases strictly with tierIndex', () => {
    for (const seed of [1, 42, 123, 777]) {
      const layout = generateLayout(seed, 'spire-ascent');
      const tiers = tiersByIndex(layout);
      for (let i = 1; i < tiers.length; i++) {
        const yPrev = sampleFloorY(layout, tiers[i - 1].x, tiers[i - 1].z);
        const yCur = sampleFloorY(layout, tiers[i].x, tiers[i].z);
        expect(yCur).toBeGreaterThan(yPrev);
      }
    }
  });

  it('each ramp has non-uniform corners and average slope ≥ 0.2', () => {
    for (const seed of [1, 42, 999]) {
      const layout = generateLayout(seed, 'spire-ascent');
      for (const ramp of roomsByBand(layout, 'ramp')) {
        const fc = ramp.floorCorners;
        const corners = [fc.yNW, fc.yNE, fc.ySE, fc.ySW];
        expect(new Set(corners).size).toBeGreaterThan(1);
        expect(rampAverageSlope(ramp)).toBeGreaterThanOrEqual(0.2);
      }
    }
  });

  it('total Y gain from bottom spawn to top tier centre is ≥ 10 units', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = generateLayout(seed, 'spire-ascent');
      const tiers = tiersByIndex(layout);
      const yBottom = sampleFloorY(layout, tiers[0].x, tiers[0].z);
      const yTop = sampleFloorY(layout, tiers[tiers.length - 1].x, tiers[tiers.length - 1].z);
      expect(yTop - yBottom).toBeGreaterThanOrEqual(10);
    }
  });

  it('assigns explicit roles: bottom=start, top=treasure, middle=combat, ramps=connector', () => {
    const layout = generateLayout(42, 'spire-ascent');
    const tiers = tiersByIndex(layout);
    expect(tiers[0].role).toBe('start');
    expect(tiers[tiers.length - 1].role).toBe('treasure');
    for (let i = 1; i < tiers.length - 1; i++) {
      expect(tiers[i].role).toBe('combat');
    }
    for (const ramp of roomsByBand(layout, 'ramp')) {
      expect(ramp.role).toBe('connector');
      expect(ramp.spawnWeight).toBe(0);
    }
  });

  it('tiers have solid exterior walls; ramps have long-side perimeter walls', () => {
    const layout = generateLayout(42, 'spire-ascent');
    const tiers = tiersByIndex(layout);
    const bottom = tiers[0];
    const top = tiers[tiers.length - 1];
    const halfD = bottom.depth / 2;
    const halfW = bottom.width / 2;

    expect(bottom.walls.some(w => w.axis === 'x' && Math.abs(w.z - (bottom.z + halfD)) < 0.01)).toBe(true);
    expect(top.walls.some(w => w.axis === 'x' && Math.abs(w.z - (top.z - top.depth / 2)) < 0.01)).toBe(true);
    expect(bottom.walls.some(w => w.axis === 'z' && Math.abs(w.x - (bottom.x - halfW)) < 0.01)).toBe(true);
    expect(bottom.walls.some(w => w.axis === 'z' && Math.abs(w.x - (bottom.x + halfW)) < 0.01)).toBe(true);

    for (const ramp of roomsByBand(layout, 'ramp')) {
      expect(ramp.walls.filter(w => w.axis === 'z').length).toBe(2);
    }
  });

  it('tiers have distinct lateral X centres (zig-zag footprint)', () => {
    for (const seed of [1, 42, 777, 9999]) {
      const layout = generateLayout(seed, 'spire-ascent');
      const tiers = tiersByIndex(layout);
      if (tiers.length < 2) continue;
      const xs = tiers.map(t => t.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0);
      expect(tiers[0].tierXOffset).toBe(0);
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].tierXOffset).toBe(tiers[i].x);
        expect(tiers[i].x).not.toBe(tiers[i - 1].x);
      }
    }
  });

  it('each ramp centre X lies between its adjoining tier centres', () => {
    for (const seed of [1, 42, 777, 9999]) {
      const layout = generateLayout(seed, 'spire-ascent');
      const tiers = tiersByIndex(layout);
      const rampList = roomsByBand(layout, 'ramp');
      for (let i = 0; i < rampList.length; i++) {
        const lowX = tiers[i].x;
        const highX = tiers[i + 1].x;
        const rampX = rampList[i].x;
        expect(rampX).toBeGreaterThanOrEqual(Math.min(lowX, highX));
        expect(rampX).toBeLessThanOrEqual(Math.max(lowX, highX));
        expect(rampX).toBeCloseTo((lowX + highX) / 2, 5);
      }
    }
  });

  it('full foot reachability from bottom spawn to top tier via ramps only', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = generateLayout(seed, 'spire-ascent');
      expect(spireReachableFromStart(layout)).toBe(true);
    }
  });

  it('every tier room is reachable (no orphan tiers)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const layout = generateLayout(seed, 'spire-ascent');
      const colliders = buildWallColliders(layout);
      const aabbs = computeWalkableAABBs(layout);
      const reached = countReachableRooms(layout, aabbs, colliders);
      expect(reached).toBe(layout.rooms.length);
    }
  });

  it('is deterministic: same seed yields deep-equal layouts', () => {
    const a = generateLayout(2024, 'spire-ascent');
    const b = generateLayout(2024, 'spire-ascent');
    expect(a).toEqual(b);
  });

  it('emits edgeHazards on middle combat tiers only', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const layout = generateLayout(seed, 'spire-ascent');
      expect(Array.isArray(layout.edgeHazards)).toBe(true);
      const tiers = tiersByIndex(layout);
      const combatTiers = tiers.filter((t) => t.role === 'combat');
      expect(layout.edgeHazards.length).toBe(combatTiers.length);
      if (combatTiers.length > 0) {
        expect(layout.edgeHazards.length).toBeGreaterThanOrEqual(1);
      }
      for (const hazard of layout.edgeHazards) {
        const tier = tiers.find((t) => t.tierIndex === hazard.tierIndex);
        expect(tier.role).toBe('combat');
        expect(hazard).toMatchObject({
          tierIndex: expect.any(Number),
          minX: expect.any(Number),
          maxX: expect.any(Number),
          minZ: expect.any(Number),
          maxZ: expect.any(Number),
          y: expect.any(Number),
        });
      }
      expect(layout.edgeHazards.some((h) => h.tierIndex === 0)).toBe(false);
      expect(layout.edgeHazards.some((h) => h.tierIndex === tiers.length - 1)).toBe(false);
    }
  });

  it('edge hazard strips lie on the exterior tier lip without spanning the walk path', () => {
    const layout = generateLayout(42, 'spire-ascent');
    for (const hazard of layout.edgeHazards) {
      const tier = tiersByIndex(layout).find((t) => t.tierIndex === hazard.tierIndex);
      const halfW = tier.width / 2;
      const stripW = hazard.maxX - hazard.minX;
      expect(stripW).toBeGreaterThan(0);
      expect(stripW).toBeLessThanOrEqual(1.5);
      const hazardCenterX = (hazard.minX + hazard.maxX) / 2;
      expect(Math.abs(hazardCenterX - tier.x)).toBeGreaterThan(halfW - stripW - 0.01);
      expect(hazard.minZ).toBeGreaterThan(tier.z - tier.depth / 2);
      expect(hazard.maxZ).toBeLessThan(tier.z + tier.depth / 2);
    }
  });

  it('spire reachability is unchanged with edge hazards present', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = generateLayout(seed, 'spire-ascent');
      expect(layout.edgeHazards.length).toBeGreaterThanOrEqual(0);
      expect(spireReachableFromStart(layout)).toBe(true);
    }
  });

  it('places exactly one spire_summit landmark at the treasure-tier centre (default mode)', () => {
    for (const seed of [1, 42, 123, 777, 9999]) {
      const layout = generateLayout(seed, 'spire-ascent', { layoutMode: 'default' });
      const treasure = tiersByIndex(layout).find((t) => t.role === 'treasure');
      expect(layout.landmarks).toHaveLength(1);
      expect(layout.landmarks[0]).toEqual({
        x: treasure.x,
        z: treasure.z,
        type: 'spire_summit',
      });
    }
  });

  it('spire_summit landmark placement is deterministic for seed 42', () => {
    expect(generateLayout(42, 'spire-ascent').landmarks).toEqual(
      generateLayout(42, 'spire-ascent').landmarks
    );
  });

  describe('rigid layoutMode', () => {
    it('unknown layoutMode values fall back to default tier variation', () => {
      const tierCounts = new Set();
      for (let seed = 1; seed <= 30; seed++) {
        const layout = generateLayout(seed, 'spire-ascent', { layoutMode: 'chaotic' });
        tierCounts.add(roomsByBand(layout, 'tier').length);
      }
      expect(tierCounts.size).toBeGreaterThan(1);
    });

    it('rigid mode produces identical rooms, edgeHazards, and landmarks across different seeds', () => {
      const seeds = [1, 42, 123, 777, 9999];
      const layouts = seeds.map((seed) =>
        generateLayout(seed, 'spire-ascent', { layoutMode: 'rigid' })
      );
      for (let i = 1; i < layouts.length; i++) {
        expect(layouts[i].rooms).toEqual(layouts[0].rooms);
        expect(layouts[i].edgeHazards).toEqual(layouts[0].edgeHazards);
        expect(layouts[i].landmarks).toEqual(layouts[0].landmarks);
      }
    });

    it('rigid mode still satisfies spire-ascent structural invariants', () => {
      const layout = generateLayout(123, 'spire-ascent', { layoutMode: 'rigid' });
      expect(layout.profile).toBe('spire-ascent');

      const tiers = tiersByIndex(layout);
      expect(tiers.length).toBe(4);
      expect(roomsByBand(layout, 'ramp').length).toBe(tiers.length - 1);

      expect(tiers[0].role).toBe('start');
      expect(tiers[tiers.length - 1].role).toBe('treasure');
      for (let i = 1; i < tiers.length - 1; i++) {
        expect(tiers[i].role).toBe('combat');
      }

      expect(tiers[0].tierXOffset).toBe(0);
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].x).not.toBe(tiers[i - 1].x);
      }

      const combatTiers = tiers.filter((t) => t.role === 'combat');
      expect(layout.edgeHazards.length).toBe(combatTiers.length);
      expect(spireReachableFromStart(layout)).toBe(true);

      const treasure = tiers[tiers.length - 1];
      expect(layout.landmarks).toHaveLength(1);
      expect(layout.landmarks[0]).toEqual({
        x: treasure.x,
        z: treasure.z,
        type: 'spire_summit',
      });
    });

    it('default mode still varies tier count across seeds', () => {
      const tierCounts = new Set();
      for (let seed = 1; seed <= 30; seed++) {
        const layout = generateLayout(seed, 'spire-ascent', { layoutMode: 'default' });
        tierCounts.add(roomsByBand(layout, 'tier').length);
      }
      expect(tierCounts.size).toBeGreaterThan(1);
    });

    it('rigid and default modes can diverge for the same seed', () => {
      const rigid = generateLayout(123, 'spire-ascent', { layoutMode: 'rigid' });
      const def = generateLayout(123, 'spire-ascent', { layoutMode: 'default' });
      const rigidAgain = generateLayout(9999, 'spire-ascent', { layoutMode: 'rigid' });
      expect(rigid.rooms).toEqual(rigidAgain.rooms);
      expect(rigid.edgeHazards).toEqual(rigidAgain.edgeHazards);
      expect(rigid.landmarks).toEqual(rigidAgain.landmarks);
      const geometryDiffers =
        JSON.stringify(rigid.rooms) !== JSON.stringify(def.rooms) ||
        JSON.stringify(rigid.edgeHazards) !== JSON.stringify(def.edgeHazards) ||
        JSON.stringify(rigid.landmarks) !== JSON.stringify(def.landmarks);
      expect(geometryDiffers).toBe(true);
    });
  });
});

// ── hub ship-interior layout ──

describe("generateLayout(seed, 'hub')", () => {
  const HUB_ZONES = ['operations', 'commerce', 'salon'];
  const BOOTH_KEYS = ['quest', 'launch', 'shop', 'deck', 'character', 'hats'];
  const BOOTH_ZONE = {
    quest: 'operations',
    launch: 'operations',
    shop: 'commerce',
    deck: 'commerce',
    character: 'salon',
    hats: 'salon',
  };

  function roomByHubZone(layout, zone) {
    return layout.rooms.filter(r => r.hubZone === zone);
  }

  function anchorInsideRoom(anchor, room, inset = 1) {
    const halfW = room.width / 2 - inset;
    const halfD = room.depth / 2 - inset;
    return (
      anchor.x >= room.x - halfW && anchor.x <= room.x + halfW &&
      anchor.z >= room.z - halfD && anchor.z <= room.z + halfD
    );
  }

  function hubReachableFromStart(layout) {
    const colliders = buildWallColliders(layout);
    const aabbs = computeWalkableAABBs(layout);
    return countReachableRooms(layout, aabbs, colliders) === layout.rooms.length;
  }

  it('has profile hub with three zone rooms and at least two passages', () => {
    const layout = generateLayout(42, 'hub');
    expect(layout.profile).toBe('hub');
    expect(layout.rooms.length).toBe(3);
    expect(layout.passages.length).toBeGreaterThanOrEqual(2);
    for (const zone of HUB_ZONES) {
      expect(roomByHubZone(layout, zone).length).toBe(1);
    }
  });

  it('assigns start to operations and spawnWeight 0 to commerce and salon', () => {
    const layout = generateLayout(42, 'hub');
    const operations = roomByHubZone(layout, 'operations')[0];
    const commerce = roomByHubZone(layout, 'commerce')[0];
    const salon = roomByHubZone(layout, 'salon')[0];
    expect(operations.role).toBe('start');
    expect(commerce.spawnWeight).toBe(0);
    expect(salon.spawnWeight).toBe(0);
  });

  it('places booth anchors inside the correct zone room with walkable floor', () => {
    const layout = generateLayout(42, 'hub');
    expect(layout.boothAnchors).toBeDefined();
    for (const key of BOOTH_KEYS) {
      expect(layout.boothAnchors[key]).toBeDefined();
    }
    const colliders = buildWallColliders(layout);
    const aabbs = computeWalkableAABBs(layout);
    for (const key of BOOTH_KEYS) {
      const anchor = layout.boothAnchors[key];
      const room = roomByHubZone(layout, BOOTH_ZONE[key])[0];
      expect(anchorInsideRoom(anchor, room, 1)).toBe(true);
      expect(isWalkable(anchor.x, anchor.z, aabbs, colliders)).toBe(true);
    }
  });

  it('all zone rooms are reachable from start via walkable floor and passages', () => {
    for (const seed of [1, 42, 123, 777]) {
      const layout = generateLayout(seed, 'hub');
      expect(hubReachableFromStart(layout)).toBe(true);
    }
  });

  it('is deterministic: same seed yields deep-equal layouts', () => {
    const a = generateLayout(2024, 'hub');
    const b = generateLayout(2024, 'hub');
    expect(a).toEqual(b);
  });
});
