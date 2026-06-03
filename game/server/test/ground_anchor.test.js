import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  applyPlayerMovement,
  applyPlayerKnockback,
  setGameState,
  rebuildWallColliders,
  computeWalkableAABBs,
  computeDungeonBounds,
} from '../simulation.js';
import { createGameState, KEY_ITEM_DEFS } from '../index.js';
import { MOVE_SPEED, TICK_RATE } from '../config.js';

function buildOpenLayout() {
  return {
    rooms: [{ x: 0, z: 0, width: 40, depth: 40, walls: [] }],
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
    anchorUntil: 0,
    anchorSpeedMultiplier: 1,
    ...overrides,
  };
}

describe('ground_anchor definition', () => {
  it('uses goal duration/cooldown and a 0.7 speed multiplier', () => {
    const def = KEY_ITEM_DEFS.ground_anchor;
    expect(def.durationMs).toBe(1500);
    expect(def.cooldownMs).toBe(6000);
    expect(def.speedMultiplier).toBe(0.7);
  });
});

describe('applyPlayerKnockback()', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    state.layout = buildOpenLayout();
    state.walkableAABBs = computeWalkableAABBs(state.layout);
    state.dungeonBounds = computeDungeonBounds(state.layout);
    setGameState(state, {});
    rebuildWallColliders();
  });

  afterEach(() => {
    vi.useRealTimers();
    setGameState(null, null);
  });

  it('moves a non-anchored player along the knockback direction', () => {
    state.players.p1 = makePlayer({ x: 0, z: 0, anchorUntil: 0 });

    const moved = applyPlayerKnockback('p1', 1, 0, 3);

    expect(moved).toBe(true);
    expect(state.players.p1.x).toBeCloseTo(3);
    expect(state.players.p1.z).toBeCloseTo(0);
  });

  it('is a no-op while the player is anchored (now < anchorUntil)', () => {
    vi.useFakeTimers();
    const now = Date.now();
    state.players.p1 = makePlayer({ x: 0, z: 0, anchorUntil: now + 1500 });

    const moved = applyPlayerKnockback('p1', 1, 0, 3);

    expect(moved).toBe(false);
    expect(state.players.p1.x).toBe(0);
    expect(state.players.p1.z).toBe(0);
  });

  it('applies the same knockback normally after anchorUntil expires', () => {
    vi.useFakeTimers();
    const now = Date.now();
    state.players.p1 = makePlayer({ x: 0, z: 0, anchorUntil: now + 1500 });

    // Still anchored: ignored.
    expect(applyPlayerKnockback('p1', 1, 0, 3)).toBe(false);
    expect(state.players.p1.x).toBe(0);

    // Advance past the anchor window: knockback now applies.
    vi.advanceTimersByTime(1600);
    const moved = applyPlayerKnockback('p1', 1, 0, 3);
    expect(moved).toBe(true);
    expect(state.players.p1.x).toBeCloseTo(3);
  });

  it('normalizes the direction vector before displacing', () => {
    state.players.p1 = makePlayer({ x: 0, z: 0, anchorUntil: 0 });

    // dir magnitude 2, strength 4 → displacement of 4 along +x
    applyPlayerKnockback('p1', 2, 0, 4);

    expect(state.players.p1.x).toBeCloseTo(4);
  });
});

describe('ground_anchor movement slow', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    state.gamePhase = 'playing';
    state.layout = buildOpenLayout();
    state.walkableAABBs = computeWalkableAABBs(state.layout);
    state.dungeonBounds = computeDungeonBounds(state.layout);
    setGameState(state, {});
    rebuildWallColliders();
  });

  afterEach(() => {
    setGameState(null, null);
  });

  it('multiplies the per-tick step by 0.7 while the anchor is active', () => {
    const step = MOVE_SPEED / TICK_RATE;
    state.players.p1 = makePlayer({
      x: 0,
      z: 0,
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now(),
      anchorUntil: Date.now() + 1500,
      anchorSpeedMultiplier: 0.7,
    });

    applyPlayerMovement();

    expect(state.players.p1.x).toBeCloseTo(step * 0.7);
  });

  it('returns to the normal step after anchorUntil has passed', () => {
    const step = MOVE_SPEED / TICK_RATE;
    state.players.p1 = makePlayer({
      x: 0,
      z: 0,
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now(),
      anchorUntil: Date.now() - 1, // already expired
      anchorSpeedMultiplier: 0.7,
    });

    applyPlayerMovement();

    expect(state.players.p1.x).toBeCloseTo(step);
  });
});
