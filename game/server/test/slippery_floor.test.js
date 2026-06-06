import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyPlayerMovement,
  buildMovementContext,
  computeWalkableAABBs,
  computeDungeonBounds,
  rebuildWallColliders,
  setGameState,
} from '../simulation.js';
import { createGameState } from '../index.js';
import { MOVE_SPEED, TICK_RATE } from '../config.js';
import { sampleFloorSurface } from '../dungeon.js';

function buildSurfaceLayout(floorSurface) {
  return {
    rooms: [{
      x: 0,
      z: 0,
      width: 30,
      depth: 30,
      floorSurface,
      walls: [],
    }],
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

function tickMovement(state, movementContext, ticks) {
  for (let i = 0; i < ticks; i++) {
    applyPlayerMovement(state, movementContext);
  }
}

describe('sampleFloorSurface(layout, x, z)', () => {
  it('returns normal by default and slippery when a room is tagged', () => {
    const layout = {
      rooms: [
        { x: 0, z: 0, width: 12, depth: 12, walls: [] },
        { x: 0, z: 20, width: 12, depth: 12, floorSurface: 'slippery', walls: [] },
      ],
      platforms: [
        {
          x: 40,
          z: 0,
          width: 8,
          depth: 8,
          floorCorners: { yNW: 1, yNE: 1, ySE: 1, ySW: 1 },
        },
        {
          x: 55,
          z: 0,
          width: 8,
          depth: 8,
          floorSurface: 'slippery',
          floorCorners: { yNW: 1, yNE: 1, ySE: 1, ySW: 1 },
        },
      ],
    };

    expect(sampleFloorSurface(layout, 0, 0)).toBe('normal');
    expect(sampleFloorSurface(layout, 0, 20)).toBe('slippery');
    expect(sampleFloorSurface(layout, 40, 0)).toBe('normal');
    expect(sampleFloorSurface(layout, 55, 0)).toBe('slippery');
    expect(sampleFloorSurface(layout, 999, 999)).toBe('normal');
  });

  it('returns normal when layout is absent', () => {
    expect(sampleFloorSurface(undefined, 0, 0)).toBe('normal');
    expect(sampleFloorSurface(null, 5, 5)).toBe('normal');
  });
});

describe('applyPlayerMovement() — slippery floors', () => {
  let state;
  let movementContext;

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    state.layout = buildSurfaceLayout('slippery');
    state.walkableAABBs = computeWalkableAABBs(state.layout);
    state.dungeonBounds = computeDungeonBounds(state.layout);
    movementContext = buildMovementContext(state);
    setGameState(state, {});
    rebuildWallColliders();
  });

  afterEach(() => {
    setGameState(null, null);
  });

  it('accelerates while holding input on a slippery floor', () => {
    state.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now(),
    });

    tickMovement(state, movementContext, 1);
    const afterOne = state.players.p1.x;

    tickMovement(state, movementContext, 4);
    const afterFive = state.players.p1.x;

    expect(afterOne).toBeGreaterThan(0);
    expect(afterFive).toBeGreaterThan(afterOne);
    expect(Math.hypot(state.players.p1.vx, state.players.p1.vz)).toBeLessThanOrEqual(MOVE_SPEED + 1e-6);
  });

  it('carries momentum after input release on a slippery floor', () => {
    state.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now(),
    });

    tickMovement(state, movementContext, 12);
    const xAfterInput = state.players.p1.x;

    state.players.p1.inputActive = false;
    state.players.p1.lastInputTime = Date.now() - 1000;
    tickMovement(state, movementContext, 5);
    const xAfterCoast = state.players.p1.x;

    expect(xAfterCoast).toBeGreaterThan(xAfterInput);
  });

  it('stops faster on normal floors than on slippery floors after input ends', () => {
    const slipperyState = state;
    slipperyState.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now(),
    });
    tickMovement(slipperyState, movementContext, 12);
    slipperyState.players.p1.inputActive = false;
    slipperyState.players.p1.lastInputTime = Date.now() - 1000;
    const slipperyStartX = slipperyState.players.p1.x;
    tickMovement(slipperyState, movementContext, 8);
    const slipperyDrift = slipperyState.players.p1.x - slipperyStartX;

    const normalState = createGameState();
    normalState.gamePhase = 'playing';
    normalState.layout = buildSurfaceLayout('normal');
    normalState.walkableAABBs = computeWalkableAABBs(normalState.layout);
    normalState.dungeonBounds = computeDungeonBounds(normalState.layout);
    const normalContext = buildMovementContext(normalState);
    setGameState(normalState, {});
    rebuildWallColliders();

    normalState.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now(),
    });
    tickMovement(normalState, normalContext, 12);
    normalState.players.p1.inputActive = false;
    normalState.players.p1.lastInputTime = Date.now() - 1000;
    const normalStartX = normalState.players.p1.x;
    tickMovement(normalState, normalContext, 8);
    const normalDrift = normalState.players.p1.x - normalStartX;

    expect(slipperyDrift).toBeGreaterThan(normalDrift);
    expect(normalDrift).toBeCloseTo(0, 5);
  });
});
