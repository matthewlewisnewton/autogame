import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  applyPlayerMovement,
  flushDirtyPlayerSaves,
  setGameState,
  setSavePlayerCallback,
  rebuildWallColliders,
  computeWalkableAABBs,
  computeDungeonBounds,
} from '../simulation.js';
import { createGameState } from '../index.js';
import { INPUT_STALE_MS, MOVE_SPEED, TICK_RATE } from '../config.js';

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

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    state.layout = buildOpenLayout();
    state.walkableAABBs = computeWalkableAABBs(state.layout);
    state.dungeonBounds = computeDungeonBounds(state.layout);
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

    applyPlayerMovement();

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

    applyPlayerMovement();

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

    applyPlayerMovement();

    expect(state.players.p1.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('ignores stale input after INPUT_STALE_MS and clears inputActive', () => {
    state.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now() - INPUT_STALE_MS - 1,
    });

    applyPlayerMovement();

    expect(state.players.p1.x).toBe(0);
    expect(state.players.p1.inputActive).toBe(false);
  });

  it('does not move rotation-only packets (inputActive false)', () => {
    state.players.p1 = makePlayer({
      inputActive: false,
      inputRotation: Math.PI,
      rotation: 0,
    });

    applyPlayerMovement();

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
    expect(saveSpy).toHaveBeenCalledWith('p1');
    expect(state.players.p1.persistenceDirty).toBe(false);
  });

  it('writes at most once even if persistenceDirty stays true across the flush', () => {
    state.players.p1 = makePlayer({ persistenceDirty: true });

    flushDirtyPlayerSaves();
    flushDirtyPlayerSaves();

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });
});
