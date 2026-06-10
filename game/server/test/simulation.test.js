import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeWalkableAABBs,
  isInsideDungeon,
  tryPlayerMove,
  gameState,
  createGameState
} from '../index.js';
import { PASSAGE_WIDTH } from '../dungeon.js';

// ── Helpers ──

function reLocal() {
  Object.assign(gameState, createGameState());
}

/**
 * Build a minimal mock layout with 2 rooms and 1 passage.
 * Room A centered at (0, 0), width=12, depth=12
 * Room B centered at (20, 0), width=12, depth=12
 * Horizontal passage connecting them (same row, different column)
 */
function buildMockLayout() {
  return {
    rooms: [
      { x: 0, z: 0, width: 12, depth: 12, walls: [] },
      { x: 20, z: 0, width: 12, depth: 12, walls: [] }
    ],
    passages: [
      { x1: 0, z1: 0, x2: 20, z2: 0, walls: [], corridorLength: 4 }
    ]
  };
}

// ── computeWalkableAABBs ──

describe('computeWalkableAABBs(layout)', () => {
  beforeEach(() => reLocal());

  it('returns an empty array when layout is null or undefined', () => {
    expect(computeWalkableAABBs(null)).toEqual([]);
    expect(computeWalkableAABBs(undefined)).toEqual([]);
    expect(computeWalkableAABBs({})).toEqual([]);
  });

  it('returns one AABB per room and one per passage', () => {
    const layout = buildMockLayout();
    const aabbs = computeWalkableAABBs(layout);

    expect(aabbs.length).toBe(3); // 2 rooms + 1 passage
  });

  it('computes correct room AABB bounds from room dimensions', () => {
    const layout = buildMockLayout();
    const aabbs = computeWalkableAABBs(layout);

    // Room A: center (0,0), width=12, depth=12 → minX=-6, maxX=6, minZ=-6, maxZ=6
    const roomA = aabbs[0];
    expect(roomA.minX).toBe(-6);
    expect(roomA.maxX).toBe(6);
    expect(roomA.minZ).toBe(-6);
    expect(roomA.maxZ).toBe(6);

    // Room B: center (20,0), width=12, depth=12 → minX=14, maxX=26, minZ=-6, maxZ=6
    const roomB = aabbs[1];
    expect(roomB.minX).toBe(14);
    expect(roomB.maxX).toBe(26);
    expect(roomB.minZ).toBe(-6);
    expect(roomB.maxZ).toBe(6);
  });

  it('computes correct passage AABB bounds using PASSAGE_WIDTH', () => {
    const layout = buildMockLayout();
    const aabbs = computeWalkableAABBs(layout);

    // Passage: x1=0, x2=20, z1=0, z2=0, PASSAGE_WIDTH=4, halfGap=2
    // minX = min(0,20) - 2 = -2, maxX = max(0,20) + 2 = 22
    // minZ = min(0,0) - 2 = -2, maxZ = max(0,0) + 2 = 2
    const passage = aabbs[2];
    expect(passage.minX).toBe(-2);
    expect(passage.maxX).toBe(22);
    expect(passage.minZ).toBe(-PASSAGE_WIDTH / 2);
    expect(passage.maxZ).toBe(PASSAGE_WIDTH / 2);
  });

  it('handles layout with rooms but no passages', () => {
    const layout = { rooms: [{ x: 5, z: 10, width: 8, depth: 10, walls: [] }] };
    const aabbs = computeWalkableAABBs(layout);

    expect(aabbs.length).toBe(1);
    expect(aabbs[0].minX).toBe(1);
    expect(aabbs[0].maxX).toBe(9);
    expect(aabbs[0].minZ).toBe(5);
    expect(aabbs[0].maxZ).toBe(15);
  });

  it('handles layout with passages but no rooms', () => {
    const layout = { passages: [{ x1: -5, z1: 0, x2: 5, z2: 0, walls: [] }] };
    const aabbs = computeWalkableAABBs(layout);

    expect(aabbs.length).toBe(1);
    expect(aabbs[0].minX).toBe(-5 - PASSAGE_WIDTH / 2);
    expect(aabbs[0].maxX).toBe(5 + PASSAGE_WIDTH / 2);
    expect(aabbs[0].minZ).toBe(-PASSAGE_WIDTH / 2);
    expect(aabbs[0].maxZ).toBe(PASSAGE_WIDTH / 2);
  });

  it('handles vertical passages correctly', () => {
    const layout = {
      rooms: [
        { x: 0, z: 0, width: 10, depth: 10, walls: [] },
        { x: 0, z: 20, width: 10, depth: 10, walls: [] }
      ],
      passages: [
        { x1: 0, z1: 0, x2: 0, z2: 20, walls: [], corridorLength: 4 }
      ]
    };
    const aabbs = computeWalkableAABBs(layout);

    const passage = aabbs[2];
    expect(passage.minX).toBe(-PASSAGE_WIDTH / 2);
    expect(passage.maxX).toBe(PASSAGE_WIDTH / 2);
    expect(passage.minZ).toBe(-2);
    expect(passage.maxZ).toBe(22);
  });
});

// ── isInsideDungeon ──

describe('isInsideDungeon(x, z)', () => {
  beforeEach(() => reLocal());

  it('returns true for positions inside a room', () => {
    gameState.walkableAABBs = [
      { minX: -6, maxX: 6, minZ: -6, maxZ: 6 }
    ];

    expect(isInsideDungeon(0, 0)).toBe(true);
    expect(isInsideDungeon(-5, 5)).toBe(true);
    expect(isInsideDungeon(5, -5)).toBe(true);
    // Boundary edges
    expect(isInsideDungeon(-6, 0)).toBe(true);
    expect(isInsideDungeon(6, 0)).toBe(true);
    expect(isInsideDungeon(0, -6)).toBe(true);
    expect(isInsideDungeon(0, 6)).toBe(true);
  });

  it('returns true for positions inside a passage', () => {
    gameState.walkableAABBs = [
      { minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
      { minX: 14, maxX: 26, minZ: -6, maxZ: 6 },
      { minX: -2, maxX: 22, minZ: -2, maxZ: 2 }
    ];

    // Position in the passage between rooms
    expect(isInsideDungeon(10, 0)).toBe(true);
    expect(isInsideDungeon(0, 0)).toBe(true);  // in room A
    expect(isInsideDungeon(20, 0)).toBe(true); // in room B
  });

  it('returns false for positions in the void between rooms', () => {
    gameState.walkableAABBs = [
      { minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
      { minX: 14, maxX: 26, minZ: -6, maxZ: 6 },
      { minX: -2, maxX: 22, minZ: -2, maxZ: 2 }
    ];

    // Outside all rooms and passages
    expect(isInsideDungeon(10, 5)).toBe(false);   // x in passage range but z outside
    expect(isInsideDungeon(10, -5)).toBe(false);  // x in passage range but z outside
    expect(isInsideDungeon(30, 0)).toBe(false);   // far outside room B
    expect(isInsideDungeon(-10, 0)).toBe(false);  // far outside room A
    expect(isInsideDungeon(0, 10)).toBe(false);   // outside room A in z
  });

  it('returns false when walkableAABBs is unset', () => {
    delete gameState.walkableAABBs;
    expect(isInsideDungeon(0, 0)).toBe(false);
  });

  it('returns false when walkableAABBs is an empty array', () => {
    gameState.walkableAABBs = [];
    expect(isInsideDungeon(0, 0)).toBe(false);
  });

  it('returns false when walkableAABBs is null', () => {
    gameState.walkableAABBs = null;
    expect(isInsideDungeon(0, 0)).toBe(false);
  });

  it('returns false for positions just outside room boundaries', () => {
    gameState.walkableAABBs = [
      { minX: -6, maxX: 6, minZ: -6, maxZ: 6 }
    ];

    expect(isInsideDungeon(-6.001, 0)).toBe(false);
    expect(isInsideDungeon(6.001, 0)).toBe(false);
    expect(isInsideDungeon(0, -6.001)).toBe(false);
    expect(isInsideDungeon(0, 6.001)).toBe(false);
  });
});

// ── tryPlayerMove ──

describe('tryPlayerMove', () => {
  beforeEach(() => {
    reLocal();
    const layout = buildMockLayout();
    gameState.layout = layout;
    gameState.walkableAABBs = computeWalkableAABBs(layout);
    // Wider than room AABBs so clampToDungeon cannot snap a void-bound move back inside walkable space.
    gameState.dungeonBounds = { minX: -20, maxX: 40, minZ: -20, maxZ: 20 };
  });

  it('moves the player to the destination on a valid in-room move', () => {
    const result = tryPlayerMove(0, 0, 1, 0, 2);
    expect(result.moved).toBe(true);
    expect(result.x).toBe(2);
    expect(result.z).toBe(0);
    expect(isInsideDungeon(result.x, result.z)).toBe(true);
  });

  it('slides along an axis when the direct move leaves walkable space', () => {
    // Near room A's north edge (maxZ=6); diagonal northeast would exit at z=7.
    const result = tryPlayerMove(0, 5, 1, 1, 2);
    expect(result.moved).toBe(true);
    expect(result.x).toBe(2);
    expect(result.z).toBe(5);
    expect(isInsideDungeon(result.x, result.z)).toBe(true);
  });

  it('rejects a move north from room center when direct and axis slides fail', () => {
    // (0,1) from (0,0) heads perpendicular to the passage into non-walkable space north of room A.
    const result = tryPlayerMove(0, 0, 0, 1, 100);
    expect(result.moved).toBe(false);
    expect(result.x).toBe(0);
    expect(result.z).toBe(0);
    expect(isInsideDungeon(result.x, result.z)).toBe(true);
  });
});
