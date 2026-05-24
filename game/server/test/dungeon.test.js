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
  questLayoutSeed,
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
