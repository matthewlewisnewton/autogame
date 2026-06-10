import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyPlayerMovement,
  buildMovementContext,
  computeWalkableAABBs,
  computeDungeonBounds,
  rebuildWallColliders,
  isInsideDungeon,
  setGameState } from '../simulation.js';
// setGameState patched below
import { createGameState } from '../index.js';
import { MOVE_SPEED, TICK_RATE, INPUT_STALE_MS } from '../config.js';
import { sampleFloorSurface, generateLayout } from '../dungeon.js';

/** Open slippery room for isolated physics experiments. */
function makeSlipperyLabLayout({ withEastWall = false } = {}) {
  const walls = withEastWall
    ? [{ axis: 'z', x: 8, z: 0, length: 24 }]
    : [];
  return {
    rooms: [{
      x: 0,
      z: 0,
      width: 20,
      depth: 30,
      floorSurface: 'slippery',
      walls,
    }],
    passages: [],
  };
}

/** Normal room north, slippery room south, connected by a passage (shared edge). */
function makeTransitionLayout() {
  return {
    passageWidth: 4,
    rooms: [
      {
        role: 'start',
        x: 0,
        z: 0,
        width: 12,
        depth: 12,
        floorSurface: 'normal',
        walls: [],
      },
      {
        x: 0,
        z: 18,
        width: 12,
        depth: 12,
        floorSurface: 'slippery',
        walls: [],
      },
    ],
    passages: [
      { x1: 0, z1: 0, x2: 0, z2: 18, walls: [], corridorLength: 18 },
    ],
  };
}

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
    vx: 0,
    vz: 0,
    persistenceDirty: false,
    ...overrides,
  };
}

function setupPlayingState(layout) {
  const state = createGameState();
  state.gamePhase = 'playing';
  state.layout = layout;
  state.walkableAABBs = computeWalkableAABBs(state.layout);
  state.dungeonBounds = computeDungeonBounds(state.layout);
  const movementContext = buildMovementContext(state);
  rebuildWallColliders();
  return { state, movementContext };
}

function tickMovement(state, n, movementContext = buildMovementContext(state)) {
  for (let i = 0; i < n; i++) {
    applyPlayerMovement(state, movementContext);
  }
}

function playerSpeed(player) {
  return Math.hypot(player.vx || 0, player.vz || 0);
}

function staleInputTime(now = Date.now()) {
  return now - INPUT_STALE_MS - 1;
}

function freshInputTime(now = Date.now()) {
  return now;
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
    ({ state, movementContext } = setupPlayingState(buildSurfaceLayout('slippery')));
  });

  afterEach(() => {
  });

  it('accelerates while holding input on a slippery floor', () => {
    state.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now(),
    });

    tickMovement(state, 1, movementContext);
    const afterOne = state.players.p1.x;

    tickMovement(state, 4, movementContext);
    const afterFive = state.players.p1.x;

    expect(afterOne).toBeGreaterThan(0);
    expect(afterFive).toBeGreaterThan(afterOne);
    expect(playerSpeed(state.players.p1)).toBeLessThanOrEqual(MOVE_SPEED + 1e-6);
  });

  it('carries momentum after input release on a slippery floor', () => {
    state.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now(),
    });

    tickMovement(state, 12, movementContext);
    const xAfterInput = state.players.p1.x;

    state.players.p1.inputActive = false;
    state.players.p1.lastInputTime = staleInputTime();
    tickMovement(state, 5, movementContext);
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
    tickMovement(slipperyState, 12, movementContext);
    slipperyState.players.p1.inputActive = false;
    slipperyState.players.p1.lastInputTime = staleInputTime();
    const slipperyStartX = slipperyState.players.p1.x;
    tickMovement(slipperyState, 8, movementContext);
    const slipperyDrift = slipperyState.players.p1.x - slipperyStartX;

    const { state: normalState, movementContext: normalContext } = setupPlayingState(buildSurfaceLayout('normal'));
    normalState.players.p1 = makePlayer({
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: Date.now(),
    });
    tickMovement(normalState, 12, normalContext);
    normalState.players.p1.inputActive = false;
    normalState.players.p1.lastInputTime = staleInputTime();
    const normalStartX = normalState.players.p1.x;
    tickMovement(normalState, 8, normalContext);
    const normalDrift = normalState.players.p1.x - normalStartX;

    expect(slipperyDrift).toBeGreaterThan(normalDrift);
    expect(normalDrift).toBeCloseTo(0, 5);
  });
});

describe('slippery floor — deceleration curve', () => {
  let state;
  let movementContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    ({ state, movementContext } = setupPlayingState(makeSlipperyLabLayout()));
    state.players.p1 = makePlayer({
      x: -8,
      z: 0,
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: freshInputTime(),
    });
    tickMovement(state, 25, movementContext);
    state.players.p1.inputActive = false;
    state.players.p1.lastInputTime = staleInputTime();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('decreases speed monotonically while coasting', () => {
    const speeds = [];
    for (let i = 0; i < 20; i++) {
      applyPlayerMovement(state, movementContext);
      speeds.push(playerSpeed(state.players.p1));
    }

    for (let i = 0; i < speeds.length - 1; i++) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i + 1] - 1e-9);
    }
  });

  it('remains above zero for at least 3 ticks after release from max speed', () => {
    const releaseSpeed = playerSpeed(state.players.p1);
    expect(releaseSpeed).toBeGreaterThan(MOVE_SPEED * 0.9);

    for (let i = 0; i < 3; i++) {
      applyPlayerMovement(state, movementContext);
      expect(playerSpeed(state.players.p1)).toBeGreaterThan(0);
    }
  });

  it('reaches ~0 within a bounded tick budget', () => {
    const maxCoastTicks = 90;
    let ticksToStop = maxCoastTicks;

    for (let i = 0; i < maxCoastTicks; i++) {
      applyPlayerMovement(state, movementContext);
      if (playerSpeed(state.players.p1) < 1e-3) {
        ticksToStop = i + 1;
        break;
      }
    }

    expect(ticksToStop).toBeLessThan(maxCoastTicks);
    expect(playerSpeed(state.players.p1)).toBeLessThan(1e-3);
  });
});

describe('slippery floor — direction change while sliding', () => {
  let state;
  let movementContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    ({ state, movementContext } = setupPlayingState(makeSlipperyLabLayout()));
    state.players.p1 = makePlayer({
      x: -8,
      z: 0,
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: freshInputTime(),
    });
    tickMovement(state, 20, movementContext);
    state.players.p1.inputActive = false;
    state.players.p1.lastInputTime = staleInputTime();
    tickMovement(state, 3, movementContext);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('redirects velocity with perpendicular input without teleporting', () => {
    const player = state.players.p1;
    const before = { x: player.x, z: player.z };
    const eastDir = { x: 1, z: 0 };
    const speedBefore = playerSpeed(player);
    const dotBefore = (player.vx * eastDir.x + player.vz * eastDir.z) / (speedBefore || 1);

    player.inputActive = true;
    player.inputDx = 0;
    player.inputDz = 1;
    player.lastInputTime = freshInputTime();
    tickMovement(state, 6, movementContext);

    const displacement = Math.hypot(player.x - before.x, player.z - before.z);
    const perTickStep = MOVE_SPEED / TICK_RATE;
    expect(displacement).toBeLessThan(perTickStep * 8);
    expect(displacement).toBeGreaterThan(0);

    const speedAfter = playerSpeed(player);
    expect(speedAfter).toBeGreaterThan(0);
    const dotAfter = (player.vx * eastDir.x + player.vz * eastDir.z) / (speedAfter || 1);
    expect(dotAfter).toBeLessThan(dotBefore);
    expect(player.vz).toBeGreaterThan(0);
  });
});

describe('slippery floor — normal → slippery transition', () => {
  let state;
  let movementContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(3_000_000);
    ({ state, movementContext } = setupPlayingState(makeTransitionLayout()));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves forward motion when crossing from normal onto ice with held input', () => {
    state.players.p1 = makePlayer({
      x: 0,
      z: 4,
      inputActive: true,
      inputDx: 0,
      inputDz: 1,
      lastInputTime: freshInputTime(),
    });

    const zSamples = [state.players.p1.z];
    const speeds = [playerSpeed(state.players.p1)];

    for (let i = 0; i < 24; i++) {
      applyPlayerMovement(state, movementContext);
      zSamples.push(state.players.p1.z);
      speeds.push(playerSpeed(state.players.p1));
    }

    for (let i = 1; i < zSamples.length; i++) {
      expect(zSamples[i]).toBeGreaterThanOrEqual(zSamples[i - 1] - 1e-9);
    }

    const player = state.players.p1;
    expect(sampleFloorSurface(state.layout, player.x, player.z)).toBe('slippery');
    expect(player.z).toBeGreaterThan(12);

    const onIceSpeeds = speeds.filter((_, i) => zSamples[i] >= 12);
    expect(onIceSpeeds.some((s) => s > 0)).toBe(true);
  });

  it('does not hard-reset velocity to zero on the first slippery tick after crossing', () => {
    state.players.p1 = makePlayer({
      x: 0,
      z: 5,
      inputActive: true,
      inputDx: 0,
      inputDz: 1,
      lastInputTime: freshInputTime(),
    });

    while (sampleFloorSurface(state.layout, state.players.p1.x, state.players.p1.z) !== 'slippery') {
      applyPlayerMovement(state, movementContext);
    }

    const beforeCross = { ...state.players.p1 };
    applyPlayerMovement(state, movementContext);
    const afterCross = state.players.p1;

    expect(afterCross.z).toBeGreaterThan(beforeCross.z);
    expect(playerSpeed(afterCross)).toBeGreaterThan(0);
  });
});

describe('slippery floor — slippery → normal transition', () => {
  let state;
  let movementContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(4_000_000);
    ({ state, movementContext } = setupPlayingState(makeTransitionLayout()));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops sharply on stone in fewer ticks than ice-only coast', () => {
    const coastSpeed = 10;
    state.players.p1 = makePlayer({
      x: 0,
      z: 13.5,
      vx: 0,
      vz: -coastSpeed,
      inputActive: false,
      lastInputTime: staleInputTime(),
    });
    expect(sampleFloorSurface(state.layout, state.players.p1.x, state.players.p1.z)).toBe('slippery');

    const transitionStartZ = state.players.p1.z;
    const coastTicks = 10;
    for (let i = 0; i < coastTicks; i++) {
      applyPlayerMovement(state, movementContext);
    }
    const transitionDrift = Math.abs(state.players.p1.z - transitionStartZ);
    expect(sampleFloorSurface(state.layout, state.players.p1.x, state.players.p1.z)).toBe('normal');
    expect(playerSpeed(state.players.p1)).toBeLessThan(1e-3);

    const { state: iceOnlyState, movementContext: iceContext } = setupPlayingState(makeSlipperyLabLayout());
    iceOnlyState.players.p1 = makePlayer({
      x: 0,
      z: 0,
      vx: 0,
      vz: -coastSpeed,
      inputActive: false,
      lastInputTime: staleInputTime(),
    });
    const iceStartZ = iceOnlyState.players.p1.z;
    for (let i = 0; i < coastTicks; i++) {
      applyPlayerMovement(iceOnlyState, iceContext);
    }
    const iceDrift = Math.abs(iceOnlyState.players.p1.z - iceStartZ);

    expect(transitionDrift).toBeLessThan(iceDrift);
    expect(playerSpeed(iceOnlyState.players.p1)).toBeGreaterThan(1);
  });
});

describe('slippery floor — wall collision while sliding', () => {
  let state;
  let movementContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000_000);
    ({ state, movementContext } = setupPlayingState(makeSlipperyLabLayout({ withEastWall: true })));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes into-wall velocity, avoids tunneling, and stays inside walkable AABB', () => {
    state.players.p1 = makePlayer({
      x: 2,
      z: 0,
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: freshInputTime(),
    });
    tickMovement(state, 35, movementContext);

    const player = state.players.p1;
    expect(player.x).toBeLessThan(8);
    expect(isInsideDungeon(player.x, player.z, movementContext)).toBe(true);

    for (const aabb of state.walkableAABBs) {
      expect(player.x).toBeGreaterThanOrEqual(aabb.minX - 1e-6);
      expect(player.x).toBeLessThanOrEqual(aabb.maxX + 1e-6);
      expect(player.z).toBeGreaterThanOrEqual(aabb.minZ - 1e-6);
      expect(player.z).toBeLessThanOrEqual(aabb.maxZ + 1e-6);
    }

    const eastwardSpeed = player.vx;
    tickMovement(state, 5, movementContext);
    expect(state.players.p1.x).toBeLessThanOrEqual(player.x + 1e-3);
    expect(state.players.p1.vx).toBeLessThanOrEqual(eastwardSpeed + 1e-6);
  });
});

describe('slippery floor — standing still on ice', () => {
  let state;
  let movementContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(6_000_000);
    ({ state, movementContext } = setupPlayingState(makeSlipperyLabLayout()));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not drift with no input and zero initial velocity', () => {
    state.players.p1 = makePlayer({
      x: 1,
      z: -2,
      vx: 0,
      vz: 0,
      inputActive: false,
      lastInputTime: staleInputTime(),
    });

    const start = { x: state.players.p1.x, z: state.players.p1.z };
    tickMovement(state, 20, movementContext);

    expect(state.players.p1.x).toBeCloseTo(start.x, 5);
    expect(state.players.p1.z).toBeCloseTo(start.z, 5);
    expect(playerSpeed(state.players.p1)).toBe(0);
  });

  it('settles tiny residual velocity from a previous slide to ~0', () => {
    state.players.p1 = makePlayer({
      x: 0,
      z: 0,
      inputActive: true,
      inputDx: 1,
      inputDz: 0,
      lastInputTime: freshInputTime(),
    });
    tickMovement(state, 15, movementContext);
    state.players.p1.inputActive = false;
    state.players.p1.lastInputTime = staleInputTime();

    tickMovement(state, 80, movementContext);
    expect(playerSpeed(state.players.p1)).toBeLessThan(1e-3);
  });
});

describe('slippery floor — ice-cavern layout slice', () => {
  it('tags slippery rooms in a generated ice-cavern layout', () => {
    const layout = generateLayout(292, 'ice-cavern');
    const slipperyRooms = layout.rooms.filter((r) => r.floorSurface === 'slippery');
    expect(slipperyRooms.length).toBeGreaterThan(0);

    const slipperyRoom = slipperyRooms[0];
    expect(sampleFloorSurface(layout, slipperyRoom.x, slipperyRoom.z)).toBe('slippery');
  });
});
