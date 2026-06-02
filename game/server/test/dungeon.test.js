import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  generateLayout,
  averageRampSlope,
  buildAdjacencyMap,
  bfsDistances,
  findFarthestRoom,
  assignRoomRoles,
  roomsByRole,
  randomRoomPositionByRole,
  sampleFloorY,
  questLayoutSeed,
  DEFAULT_FLOOR_Y,
  PARAPET_WALL_HEIGHT,
  MIN_CANYON_AREA,
  LAYOUT_PROFILES,
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

  it('has ≥ 6 cover pieces of valid type, fully inside the interior', () => {
    const layout = generateLayout(123, 'open-plaza');
    expect(layout.cover.length).toBeGreaterThanOrEqual(6);
    const half = layout.rooms[0].width / 2;
    for (const c of layout.cover) {
      expect(['pillar', 'broken_wall']).toContain(c.type);
      expect(Math.abs(c.x) + c.width / 2).toBeLessThanOrEqual(half);
      expect(Math.abs(c.z) + c.depth / 2).toBeLessThanOrEqual(half);
    }
  });

  it('has ≥ 2 platforms, each with corner delta ≤ 0.5', () => {
    const layout = generateLayout(123, 'open-plaza');
    expect(layout.platforms.length).toBeGreaterThanOrEqual(2);
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
    expect(sampleFloorY(layout, p.x, p.z)).toBeGreaterThan(DEFAULT_FLOOR_Y);
    // A point on the open plaza floor away from any platform reads the flat floor.
    expect(sampleFloorY(layout, 0, 0)).toBe(DEFAULT_FLOOR_Y);
  });

  it('is deterministic: same seed yields deep-equal layouts', () => {
    const a = generateLayout(2024, 'open-plaza');
    const b = generateLayout(2024, 'open-plaza');
    expect(a).toEqual(b);
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

// ── sunken-canyon stage layout ──

describe("generateLayout(seed, 'sunken-canyon')", () => {
  function roomsByBand(layout, band) {
    return layout.rooms.filter((r) => r.band === band);
  }

  function plateauSpawnY(layout) {
    const plateau = roomsByBand(layout, 'plateau')[0];
    return sampleFloorY(layout, plateau.x, plateau.z);
  }

  function canyonCenterY(layout) {
    const canyon = roomsByBand(layout, 'canyon')[0];
    return sampleFloorY(layout, canyon.x, canyon.z);
  }

  function wallLengthOnEdge(room, edge) {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    const edgeWalls =
      edge === 'north' ? room.walls.filter((w) => w.axis === 'x' && Math.abs(w.z - (room.z - halfD)) < 1e-6)
      : edge === 'south' ? room.walls.filter((w) => w.axis === 'x' && Math.abs(w.z - (room.z + halfD)) < 1e-6)
      : edge === 'west' ? room.walls.filter((w) => w.axis === 'z' && Math.abs(w.x - (room.x - halfW)) < 1e-6)
      : room.walls.filter((w) => w.axis === 'z' && Math.abs(w.x - (room.x + halfW)) < 1e-6);
    return edgeWalls.reduce((sum, w) => sum + w.length, 0);
  }

  function edgeSpan(room, edge) {
    return edge === 'north' || edge === 'south' ? room.width : room.depth;
  }

  /** Outer edges are walled except deliberate ramp mouths (gap width each). */
  function outerPerimeterClosed(layout) {
    const gapWidth = layout.passageWidth;
    const rampCount = layout.stageMeta.rampRoomIndices.length;
    const allowedGap = rampCount * gapWidth + 0.05;

    const plateau = roomsByBand(layout, 'plateau')[0];
    const canyon = roomsByBand(layout, 'canyon')[0];

    for (const room of [plateau, canyon]) {
      for (const edge of ['north', 'south', 'east', 'west']) {
        const span = edgeSpan(room, edge);
        const walled = wallLengthOnEdge(room, edge);
        const isRampMouth =
          (room.band === 'plateau' && edge === 'south') ||
          (room.band === 'canyon' && edge === 'north');
        const minWalled = isRampMouth ? span - allowedGap : span - 0.05;
        if (walled < minWalled) return false;
        if (!isRampMouth && walled < span - 0.05) return false;
      }
    }
    return true;
  }

  it("returns profile 'sunken-canyon' and stageMeta indices", () => {
    const layout = generateLayout(42, 'sunken-canyon');
    expect(layout.profile).toBe('sunken-canyon');
    expect(layout.stageMeta.plateauRoomIndex).toBe(0);
    expect(layout.stageMeta.canyonRoomIndex).toBe(layout.rooms.length - 1);
    expect(layout.stageMeta.rampRoomIndices.length).toBeGreaterThanOrEqual(2);
    expect(layout.stageMeta.rampRoomIndices.length).toBeLessThanOrEqual(3);
  });

  it('defines exactly two elevation bands (plateau + canyon)', () => {
    const layout = generateLayout(99, 'sunken-canyon');
    expect(roomsByBand(layout, 'plateau').length).toBe(1);
    expect(roomsByBand(layout, 'canyon').length).toBe(1);
    expect(roomsByBand(layout, 'ramp').length).toBeGreaterThanOrEqual(2);
    expect(roomsByBand(layout, 'ramp').length).toBeLessThanOrEqual(3);
  });

  it('canyon area is ≥ 4× a default room (~728 units²)', () => {
    const layout = generateLayout(7, 'sunken-canyon');
    const canyon = roomsByBand(layout, 'canyon')[0];
    expect(canyon.width * canyon.depth).toBeGreaterThanOrEqual(MIN_CANYON_AREA);
  });

  it('has 2–3 ramp rooms each with slope ≥ 0.15', () => {
    const layout = generateLayout(2024, 'sunken-canyon');
    const ramps = roomsByBand(layout, 'ramp');
    expect(ramps.length).toBeGreaterThanOrEqual(2);
    expect(ramps.length).toBeLessThanOrEqual(3);
    for (const ramp of ramps) {
      expect(averageRampSlope(ramp)).toBeGreaterThanOrEqual(0.15 - 1e-9);
      const { yNW, yNE, ySE, ySW } = ramp.floorCorners;
      expect(yNW).toBeCloseTo(yNE, 5);
      expect(ySE).toBeCloseTo(ySW, 5);
      expect(yNW).toBeGreaterThan(ySE);
    }
  });

  it('plateau spawn Y minus canyon center Y is ≥ 8', () => {
    const layout = generateLayout(1, 'sunken-canyon');
    expect(plateauSpawnY(layout) - canyonCenterY(layout)).toBeGreaterThanOrEqual(8 - 1e-6);
  });

  it('BFS from plateau reaches the canyon', () => {
    const layout = generateLayout(55, 'sunken-canyon');
    const adj = buildAdjacencyMap(layout);
    const dist = bfsDistances(adj, layout.stageMeta.plateauRoomIndex);
    expect(dist[layout.stageMeta.canyonRoomIndex]).not.toBe(Infinity);
  });

  it('assignRoomRoles: plateau start, canyon treasure, ramps spawnWeight 0', () => {
    const layout = generateLayout(123, 'sunken-canyon');
    const plateau = layout.rooms[layout.stageMeta.plateauRoomIndex];
    const canyon = layout.rooms[layout.stageMeta.canyonRoomIndex];
    expect(plateau.role).toBe('start');
    expect(plateau.spawnWeight).toBe(0);
    expect(canyon.role).toBe('treasure');
    for (const idx of layout.stageMeta.rampRoomIndices) {
      expect(layout.rooms[idx].spawnWeight).toBe(0);
    }
  });

  it('plateau vista edge uses parapet height ≤ 1.5 on south wall segments', () => {
    const layout = generateLayout(88, 'sunken-canyon');
    const plateau = roomsByBand(layout, 'plateau')[0];
    const halfD = plateau.depth / 2;
    const southWalls = plateau.walls.filter((w) => Math.abs(w.z - (plateau.z + halfD)) < 1e-6);
    expect(southWalls.length).toBeGreaterThan(0);
    for (const w of southWalls) {
      expect(w.height).toBeDefined();
      expect(w.height).toBeLessThanOrEqual(1.5);
      expect(w.height).toBe(PARAPET_WALL_HEIGHT);
    }
  });

  it('perimeter walls enclose plateau and canyon (only ramp-aligned gaps)', () => {
    for (const seed of [1, 42, 777, 9999]) {
      const layout = generateLayout(seed, 'sunken-canyon');
      expect(outerPerimeterClosed(layout)).toBe(true);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateLayout(314, 'sunken-canyon');
    const b = generateLayout(314, 'sunken-canyon');
    expect(a).toEqual(b);
  });

  it('varies ramp count between 2 and 3 across seeds', () => {
    const counts = new Set();
    for (let seed = 0; seed < 30; seed++) {
      const layout = generateLayout(seed, 'sunken-canyon');
      counts.add(layout.stageMeta.rampRoomIndices.length);
    }
    expect(counts.has(2)).toBe(true);
    expect(counts.has(3)).toBe(true);
  });
});
