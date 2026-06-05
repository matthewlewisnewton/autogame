import { describe, it, expect } from 'vitest';
import { OBJECTIVE_DEFS, SURVIVE_SPAWN_INTERVAL_MS } from '../objectives.js';
import {
  DIFFICULTY_SPAWN_RATE_PER_PLAYER,
  difficultyScaleFactor,
} from '../config.js';

const survive = OBJECTIVE_DEFS.survive;

// Minimal deterministic ctx — the spawner only needs these helpers, and the
// scaling test cares about *when* a spawn fires, not where/what it is.
function makeCtx() {
  return {
    mulberry32: () => () => 0.5,
    pickEnemySpawnPosition: () => ({ x: 0, z: 0 }),
    spawnEnemy: () => ({}),
    roomTierAt: () => 0,
    randomWanderTarget: () => ({ x: 0, z: 0 }),
  };
}

// Build a playing survive run with `count` active players. totalSpawns is large
// so the wave never exhausts during the test.
function makeGameState(count) {
  const players = {};
  for (let i = 0; i < count; i++) players[`p${i}`] = { id: `p${i}` };
  return {
    gamePhase: 'playing',
    layout: { rooms: [] },
    layoutSeed: 42,
    players,
    run: {
      status: 'playing',
      objective: {
        type: 'survive',
        totalSpawns: 999,
        minibossCount: 0,
        enemyPool: [],
        spawnedEnemies: 0,
        defeatedEnemies: 0,
        totalEnemies: 999,
        lastSpawnAt: 0,
      },
    },
  };
}

// Returns the effective throttle interval for the current live player count by
// probing the boundary: the spawner blocks while `now - lastSpawnAt < interval`.
// We seed lastSpawnAt to a non-zero baseline so the first-spawn-fires-immediately
// rule doesn't interfere.
function effectiveInterval(gameState, ctx) {
  const objective = gameState.run.objective;
  const base = 1_000_000; // arbitrary non-zero baseline timestamp
  objective.lastSpawnAt = base;
  const before = objective.spawnedEnemies;

  // Binary-search the smallest elapsed time at which a spawn fires.
  let lo = 0;
  let hi = SURVIVE_SPAWN_INTERVAL_MS + 1; // interval can only ever shrink from baseline
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    objective.spawnedEnemies = before;
    objective.lastSpawnAt = base;
    survive.tickSpawns(base + mid, gameState, ctx);
    if (objective.spawnedEnemies > before) {
      hi = mid; // spawned → interval is at or below mid
    } else {
      lo = mid; // blocked → interval is above mid
    }
  }
  // restore
  objective.spawnedEnemies = before;
  objective.lastSpawnAt = base;
  return hi;
}

function expectedInterval(count) {
  return SURVIVE_SPAWN_INTERVAL_MS / difficultyScaleFactor(count, DIFFICULTY_SPAWN_RATE_PER_PLAYER);
}

describe('survive spawn-rate scaling with live player count', () => {
  it('1–4 players keep the baseline interval (no behaviour change)', () => {
    const ctx = makeCtx();
    for (const count of [1, 2, 3, 4]) {
      const gs = makeGameState(count);
      expect(effectiveInterval(gs, ctx)).toBeCloseTo(SURVIVE_SPAWN_INTERVAL_MS, 0);
      expect(effectiveInterval(gs, ctx)).toBeCloseTo(expectedInterval(count), 0);
    }
  });

  it('5..16 players spawn faster, scaled per extra player and capped at 16', () => {
    const ctx = makeCtx();
    for (const count of [5, 8, 12, 16]) {
      const gs = makeGameState(count);
      const interval = effectiveInterval(gs, ctx);
      expect(interval).toBeLessThan(SURVIVE_SPAWN_INTERVAL_MS);
      expect(interval).toBeCloseTo(expectedInterval(count), 0);
    }
    // Beyond the cap the interval stops shrinking (16 == 20-player clamp).
    expect(effectiveInterval(makeGameState(20), ctx))
      .toBeCloseTo(effectiveInterval(makeGameState(16), ctx), 0);
  });

  it('tracks a mid-run JOIN (shorter) then a mid-run LEAVE (longer) live', () => {
    const ctx = makeCtx();
    const gs = makeGameState(4); // start at baseline

    const baselineInterval = effectiveInterval(gs, ctx);
    expect(baselineInterval).toBeCloseTo(SURVIVE_SPAWN_INTERVAL_MS, 0);

    // JOIN: 8 players join mid-run → interval shortens immediately.
    for (let i = 4; i < 12; i++) gs.players[`join${i}`] = { id: `join${i}` };
    const joinedInterval = effectiveInterval(gs, ctx);
    expect(joinedInterval).toBeLessThan(baselineInterval);
    expect(joinedInterval).toBeCloseTo(expectedInterval(12), 0);

    // LEAVE: drop back down to 5 players → interval lengthens again.
    for (let i = 5; i < 12; i++) delete gs.players[`join${i}`];
    const leftInterval = effectiveInterval(gs, ctx);
    expect(leftInterval).toBeGreaterThan(joinedInterval);
    expect(leftInterval).toBeCloseTo(expectedInterval(5), 0);

    // LEAVE back to baseline range → interval returns to baseline.
    for (let i = 4; i < 5; i++) delete gs.players[`join${i}`];
    delete gs.players.p3; // now 3 players remain (p0,p1,p2)
    const baseAgain = effectiveInterval(gs, ctx);
    expect(baseAgain).toBeCloseTo(SURVIVE_SPAWN_INTERVAL_MS, 0);
  });
});
