import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  applyPlayerMovement,
  applySpireEdgeHazardResponse,
  findSpireEdgeHazardAt,
  buildMovementContext,
  flushDirtyPlayerSaves,
  setGameState,
  setSavePlayerCallback,
  rebuildWallColliders,
  computeWalkableAABBs,
  computeDungeonBounds,
} from '../simulation.js';
import { createGameState } from '../index.js';
import { INPUT_STALE_MS, MOVE_SPEED, TICK_RATE, MAX_HP, SPIRE_EDGE_HAZARD_DAMAGE } from '../config.js';
import { generateLayout } from '../dungeon.js';
import { sampleFloorY, DEFAULT_FLOOR_Y, resolveFloorY } from '../dungeon.js';

function buildOpenLayout() {
  return {
    rooms: [{ x: 0, z: 0, width: 20, depth: 20, walls: [] }],
    passages: [],
  };
}

function makePlayer(overrides = {}) {
  return {
    id: 'p1',
    x: 0,
    y: 0.5,
    z: 0,
    rotation: 0,
    dead: false,
    inputDx: 0,
    inputDz: 0,
    inputRotation: 0,
    inputActive: false,
    lastInputTime: Date.now(),
    persistenceDirty: false,
    ...overrides,
  };
}

describe('applyPlayerMovement()', () => {
  let state;
  let saveSpy;
  let movementContext;

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    state.layout = buildOpenLayout();
    state.walkableAABBs = computeWalkableAABBs(state.layout);
    state.dungeonBounds = computeDungeonBounds(state.layout);
    movementContext = buildMovementContext(state);
    setGameState(state, {});
    rebuildWallColliders();
    saveSpy = vi.fn();
    setSavePlayerCallback(saveSpy);
  });

  afterEach(() => {
    setSavePlayerCallback(null);
    setGameState(null, null);
  });

  it('moves an active player one fixed tick step along input', () => {
    state.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now(),
    });

    applyPlayerMovement(state, movementContext);

    const step = MOVE_SPEED / TICK_RATE;
    expect(state.players.p1.x).toBeCloseTo(step);
    expect(state.players.p1.z).toBeCloseTo(0);
    expect(state.players.p1.persistenceDirty).toBe(true);
  });

  it('preserves analog input magnitude (half stick ≈ half displacement)', () => {
    state.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 0.5,
      inputDz: 0,
      lastInputTime: Date.now(),
    });

    applyPlayerMovement(state, movementContext);

    const step = MOVE_SPEED / TICK_RATE;
    expect(state.players.p1.x).toBeCloseTo(0.5 * step);
  });

  it('applies stored inputRotation while moving', () => {
    state.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      inputRotation: Math.PI / 2,
      rotation: 0,
      lastInputTime: Date.now(),
    });

    applyPlayerMovement(state, movementContext);

    expect(state.players.p1.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('ignores stale input after INPUT_STALE_MS and clears inputActive', () => {
    state.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now() - INPUT_STALE_MS - 1,
    });

    applyPlayerMovement(state, movementContext);

    expect(state.players.p1.x).toBe(0);
    expect(state.players.p1.inputActive).toBe(false);
  });

  it('does not move rotation-only packets (inputActive false)', () => {
    state.players.p1 = makePlayer({
      inputActive: false,
      inputRotation: Math.PI,
      rotation: 0,
    });

    applyPlayerMovement(state, movementContext);

    expect(state.players.p1.x).toBe(0);
    expect(state.players.p1.z).toBe(0);
  });
});

describe('flushDirtyPlayerSaves()', () => {
  let state;
  let saveSpy;

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    setGameState(state, {});
    saveSpy = vi.fn();
    setSavePlayerCallback(saveSpy);
  });

  afterEach(() => {
    setSavePlayerCallback(null);
    setGameState(null, null);
  });

  it('persists rotation-only updates flagged by the move handler once per tick', () => {
    state.players.p1 = makePlayer({
      persistenceDirty: true,
      rotation: 1.25,
    });

    flushDirtyPlayerSaves();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(state, 'p1');
    expect(state.players.p1.persistenceDirty).toBe(false);
  });

  it('writes at most once even if persistenceDirty stays true across the flush', () => {
    state.players.p1 = makePlayer({ persistenceDirty: true });

    flushDirtyPlayerSaves();
    flushDirtyPlayerSaves();

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });
});

// ── Slope movement tests ──

/**
 * Build a layout with a flat room at origin and a sloped room to the south,
 * connected by a passage. The sloped room ramps from Y=0.5 (north edge) to
 * Y=2.0 (south edge). An eastern wall is placed on the sloped room for
 * wall-sliding regression tests.
 */
function buildSlopedLayout() {
  const wallX = 6; // eastern wall of sloped room (room center 0 + width/2)

  return {
    rooms: [
      // Flat room at origin
      {
        x: 0, z: 0, width: 12, depth: 12,
        floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 0.5, ySW: 0.5 },
        walls: [],
      },
      // Sloped room to the south — ramps from 0.5 (north) to 2.0 (south)
      {
        x: 0, z: 18, width: 12, depth: 12,
        floorCorners: { yNW: 0.5, yNE: 0.5, ySE: 2.0, ySW: 2.0 },
        walls: [
          // Eastern wall at x = +6 (room center 0 + halfW 6)
          { axis: 'z', x: wallX, z: 18, length: 12 },
        ],
      },
    ],
    passages: [
      { x1: 0, z1: 0, x2: 0, z2: 18, walls: [], corridorLength: 18 },
    ],
  };
}

describe('applyPlayerMovement() — slope movement', () => {
  let state;
  let saveSpy;
  let movementContext;

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    state.layout = buildSlopedLayout();
    state.walkableAABBs = computeWalkableAABBs(state.layout);
    state.dungeonBounds = computeDungeonBounds(state.layout);
    movementContext = buildMovementContext(state);
    setGameState(state, {});
    rebuildWallColliders();
    saveSpy = vi.fn();
    setSavePlayerCallback(saveSpy);
  });

  afterEach(() => {
    setSavePlayerCallback(null);
    setGameState(null, null);
  });

  it('sets player.y from sampleFloorY when moving on a ramp', () => {
    // Place player in flat room, near south edge to enter sloped room quickly
    state.players.p1 = makePlayer({
      x: 0,
      z: 4,
      y: 0.5,
      inputActive: true,
      inputDx: 0,
      inputDz: 1, // move south
      lastInputTime: Date.now(),
    });

    // Apply enough ticks to move player from z=4 into the sloped room (z>=12)
    // Room A ends at z=6, passage covers z=-2..16, sloped room starts at z=12
    // Distance to sloped room edge: ~8 units. Step = 12/20 = 0.6 per tick.
    // 8 / 0.6 ≈ 14 ticks to reach z=12, then more to go deeper.
    const step = MOVE_SPEED / TICK_RATE;
    const ticksToEnter = Math.ceil(8 / step) + 4; // enter + 4 more ticks south
    for (let i = 0; i < ticksToEnter; i++) {
      applyPlayerMovement(state, movementContext);
    }

    const player = state.players.p1;

    // Player should have entered the sloped room (z >= 12)
    expect(player.z).toBeGreaterThanOrEqual(12);

    // Player Y should be above flat floor (0.5) due to slope
    expect(player.y).toBeGreaterThan(0.5);

    // Verify Y matches sampleFloorY at current position
    const expectedY = sampleFloorY(state.layout, player.x, player.z);
    expect(expectedY).not.toBeNull();
    expect(player.y).toBeCloseTo(expectedY, 5);
  });

  it('falls back to DEFAULT_FLOOR_Y when sampleFloorY returns null', () => {
    // Place player in a passage midpoint that is between room AABBs but
    // inside the passage walkable AABB. sampleFloorY only checks rooms,
    // so it returns null for passage positions.
    //
    // The passage connects (0,0) to (0,18), so its AABB covers
    // x:[-2,22], z:[-2,16]. Room A covers z:[-6,6], Room B covers z:[12,24].
    // The gap z=(6,12) is in passage but not in any room → sampleFloorY null.
    state.players.p1 = makePlayer({
      x: 0,
      z: 9, // between room A (z max 6) and room B (z min 12)
      y: 99, // arbitrary non-default value to detect fallback
      inputActive: true,
      inputDx: 0,
      inputDz: 0.01, // tiny southward nudge to trigger floor sampling
      lastInputTime: Date.now(),
    });

    applyPlayerMovement(state, movementContext);

    expect(state.players.p1.y).toBe(DEFAULT_FLOOR_Y);
  });

  it('wall sliding works on sloped rooms', () => {
    // Place player near the eastern wall of the sloped room (wall at x=+6).
    // Player at x=5.8 is close enough that moving south will hit the wall.
    const playerStartX = 5.8;
    const playerStartZ = 14; // inside sloped room (z range: 12..24)

    state.players.p1 = makePlayer({
      x: playerStartX,
      z: playerStartZ,
      y: resolveFloorY(sampleFloorY(state.layout, playerStartX, playerStartZ)),
      inputActive: true,
      inputDx: 0,
      inputDz: 1, // move south (parallel to eastern wall)
      lastInputTime: Date.now(),
    });

    applyPlayerMovement(state, movementContext);

    const player = state.players.p1;

    // Player should have moved southward (wall-slide along Z)
    expect(player.z).toBeGreaterThan(playerStartZ);

    // Player X should be pushed away from the wall (wall at x=+6, player radius 0.5)
    // so player.x + radius <= wall.minX (approximately)
    expect(player.x).toBeLessThan(playerStartX);

    // Y should be sampled from the slope at the resolved position
    const expectedY = sampleFloorY(state.layout, player.x, player.z);
    if (expectedY !== null) {
      expect(player.y).toBeCloseTo(expectedY, 3);
      expect(player.y).toBeGreaterThan(0.5);
    } else {
      // If somehow outside room, should fall back to DEFAULT_FLOOR_Y
      expect(player.y).toBe(DEFAULT_FLOOR_Y);
    }
  });
});

describe('spire-ascent edge hazards', () => {
  let state;
  let movementContext;

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    state.layout = generateLayout(42, 'spire-ascent');
    state.walkableAABBs = computeWalkableAABBs(state.layout);
    state.dungeonBounds = computeDungeonBounds(state.layout);
    movementContext = buildMovementContext(state);
    setGameState(state, {});
    rebuildWallColliders();
  });

  afterEach(() => {
    setGameState(null, null);
  });

  it('repositions and chips HP when standing inside a hazard strip', () => {
    const hazard = state.layout.edgeHazards[0];
    expect(hazard).toBeDefined();

    const startHp = MAX_HP;
    state.players.p1 = makePlayer({
      x: (hazard.minX + hazard.maxX) / 2,
      z: (hazard.minZ + hazard.maxZ) / 2,
      hp: startHp,
      inputActive: false,
    });

    applyPlayerMovement(state, movementContext);

    const player = state.players.p1;
    expect(findSpireEdgeHazardAt(state.layout, player.x, player.z)).toBeNull();
    expect(player.hp).toBe(startHp - SPIRE_EDGE_HAZARD_DAMAGE);
  });

  it('applySpireEdgeHazardResponse snaps player toward tier centre on the same tier', () => {
    const hazard = state.layout.edgeHazards[0];
    const tier = state.layout.rooms.find((r) => r.tierIndex === hazard.tierIndex);
    state.players.p1 = makePlayer({
      x: hazard.maxX - 0.1,
      z: (hazard.minZ + hazard.maxZ) / 2,
      hp: MAX_HP,
    });
    const player = state.players.p1;

    const resolved = applySpireEdgeHazardResponse('p1', player, state.layout);
    expect(resolved).toBe(true);
    expect(Math.abs(player.x - tier.x)).toBeLessThan(tier.width / 2);
    expect(player.hp).toBe(MAX_HP - SPIRE_EDGE_HAZARD_DAMAGE);
  });
});

describe('sunken-canyon cliff hazards', () => {
  let state;
  let movementContext;

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    state.layout = generateLayout(42, 'sunken-canyon');
    state.walkableAABBs = computeWalkableAABBs(state.layout);
    state.dungeonBounds = computeDungeonBounds(state.layout);
    movementContext = buildMovementContext(state);
    setGameState(state, {});
    rebuildWallColliders();
  });

  afterEach(() => {
    setGameState(null, null);
  });

  it('repositions and chips HP when standing inside a plateau cliff hazard strip', () => {
    const hazard = state.layout.edgeHazards[0];
    expect(hazard).toBeDefined();

    const startHp = MAX_HP;
    state.players.p1 = makePlayer({
      x: (hazard.minX + hazard.maxX) / 2,
      z: (hazard.minZ + hazard.maxZ) / 2,
      hp: startHp,
      inputActive: false,
    });

    applyPlayerMovement(state, movementContext);

    const player = state.players.p1;
    expect(findSpireEdgeHazardAt(state.layout, player.x, player.z)).toBeNull();
    expect(player.hp).toBe(startHp - SPIRE_EDGE_HAZARD_DAMAGE);
  });

  it('applySpireEdgeHazardResponse snaps player toward plateau interior from cliff hazard', () => {
    const hazard = state.layout.edgeHazards.find((h) => h.side === 'south')
      || state.layout.edgeHazards[0];
    const plateau = state.layout.rooms.find((r) => r.band === 'plateau');
    const startX = hazard.side === 'west'
      ? hazard.minX + 0.1
      : hazard.side === 'east'
        ? hazard.maxX - 0.1
        : (hazard.minX + hazard.maxX) / 2;
    const startZ = hazard.side === 'south'
      ? hazard.maxZ - 0.1
      : (hazard.minZ + hazard.maxZ) / 2;
    state.players.p1 = makePlayer({
      x: startX,
      z: startZ,
      hp: MAX_HP,
    });
    const player = state.players.p1;

    const resolved = applySpireEdgeHazardResponse('p1', player, state.layout);
    expect(resolved).toBe(true);
    expect(Math.abs(player.x - plateau.x)).toBeLessThan(plateau.width / 2);
    expect(Math.abs(player.z - plateau.z)).toBeLessThan(plateau.depth / 2);
    expect(player.hp).toBe(MAX_HP - SPIRE_EDGE_HAZARD_DAMAGE);
  });
});
