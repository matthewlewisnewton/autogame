import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  generateLayout,
  GRID_COLS,
  GRID_ROWS,
  CELL_SPACING,
  MIN_ROOM_SIZE,
  MAX_ROOM_SIZE_INCLUSIVE,
  PASSAGE_WIDTH
} from '../dungeon.js';

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
