import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VARIANT_DEFS,
  FRENZIED_ENRAGE_HP_FRACTION,
  getFrenziedCombatMultipliers,
} from '../enemyVariants.js';
import {
  createGameState,
  gameState,
  updateEnemies,
  ENEMY_DEFS,
  DETECTION_RADIUS,
} from '../index.js';

function resetState() {
  Object.assign(gameState, createGameState());
}

function addPlayer(id, overrides = {}) {
  gameState.players[id] = {
    x: 0,
    y: 0.5,
    z: 0,
    rotation: 0,
    hp: 100,
    dead: false,
    lastActivity: Date.now(),
    ready: false,
    magicStones: 30,
    currency: 0,
    debugScenario: null,
    pendingSummons: new Set(),
    deck: [],
    ...overrides,
  };
}

function makeChasingGrunt(overrides = {}) {
  const startDist = DETECTION_RADIUS - 1;
  return {
    id: 'grunt',
    x: startDist,
    z: 0,
    type: 'grunt',
    hp: 100,
    maxHp: 100,
    state: 'idle',
    attackState: 'idle',
    wanderTarget: { x: startDist, z: 0 },
    ...overrides,
  };
}

describe('VARIANT_DEFS.frenzied', () => {
  it('defines frenzied with enrage tuning and bonusDrop', () => {
    const def = VARIANT_DEFS.frenzied;
    expect(def).toBeDefined();
    expect(def.id).toBe('frenzied');
    expect(typeof def.name).toBe('string');
    expect(def.apply).toBeNull();
    expect(def.chaseSpeedMult).toBeGreaterThan(1);
    expect(def.attackWindupMult).toBeGreaterThan(0);
    expect(def.attackWindupMult).toBeLessThan(1);
    expect(def.bonusDrop).toEqual({ card: true, magicStone: 15 });
    expect(FRENZIED_ENRAGE_HP_FRACTION).toBe(0.5);
  });
});

describe('getFrenziedCombatMultipliers', () => {
  it('returns 1 when not frenzied or above enrage threshold', () => {
    expect(getFrenziedCombatMultipliers({ variant: null, hp: 40, maxHp: 100 })).toEqual({
      chaseSpeedMult: 1,
      attackWindupMult: 1,
    });
    expect(getFrenziedCombatMultipliers({ variant: 'frenzied', hp: 50, maxHp: 100 })).toEqual({
      chaseSpeedMult: 1,
      attackWindupMult: 1,
    });
  });

  it('returns registry multipliers when frenzied and below 50% maxHp', () => {
    expect(getFrenziedCombatMultipliers({ variant: 'frenzied', hp: 49, maxHp: 100 })).toEqual({
      chaseSpeedMult: VARIANT_DEFS.frenzied.chaseSpeedMult,
      attackWindupMult: VARIANT_DEFS.frenzied.attackWindupMult,
    });
  });
});

describe('frenzied enrage in updateEnemies()', () => {
  beforeEach(() => {
    resetState();
  });

  it('frenzied grunt below 50% maxHp chases farther per tick than at full HP', () => {
    const startDist = DETECTION_RADIUS - 1;

    addPlayer('p1', { x: 0, z: 0, dead: false });
    gameState.enemies.push(
      makeChasingGrunt({ id: 'full', variant: 'frenzied', hp: 100, maxHp: 100, x: startDist }),
    );
    const fullXBefore = gameState.enemies[0].x;
    updateEnemies();
    const fullMoved = Math.abs(fullXBefore - gameState.enemies[0].x);

    resetState();

    addPlayer('p1', { x: 0, z: 0, dead: false });
    gameState.enemies.push(
      makeChasingGrunt({ id: 'enraged', variant: 'frenzied', hp: 40, maxHp: 100, x: startDist }),
    );
    const enragedXBefore = gameState.enemies[0].x;
    updateEnemies();
    const enragedMoved = Math.abs(enragedXBefore - gameState.enemies[0].x);

    expect(enragedMoved).toBeGreaterThan(fullMoved);
  });

  it('non-frenzied grunt does not speed up when damaged below 50% maxHp', () => {
    const startDist = DETECTION_RADIUS - 1;

    addPlayer('p1', { x: 0, z: 0, dead: false });
    gameState.enemies.push(
      makeChasingGrunt({ id: 'full', variant: null, hp: 100, maxHp: 100, x: startDist }),
    );
    const fullXBefore = gameState.enemies[0].x;
    updateEnemies();
    const fullMoved = Math.abs(fullXBefore - gameState.enemies[0].x);

    resetState();

    addPlayer('p1', { x: 0, z: 0, dead: false });
    gameState.enemies.push(
      makeChasingGrunt({ id: 'damaged', variant: null, hp: 40, maxHp: 100, x: startDist }),
    );
    const damagedXBefore = gameState.enemies[0].x;
    updateEnemies();
    const damagedMoved = Math.abs(damagedXBefore - gameState.enemies[0].x);

    expect(damagedMoved).toBeCloseTo(fullMoved, 5);
  });
});

describe('frenzied enrage attack wind-up in updateEnemies()', () => {
  beforeEach(() => {
    resetState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2000, 0, 1));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enraged frenzied grunt strikes sooner than at full HP', () => {
    const baseWindup = ENEMY_DEFS.grunt.attackWindupMs;
    const enragedMult = VARIANT_DEFS.frenzied.attackWindupMult;
    const now = Date.now();

    addPlayer('pFull', { id: 'pFull', x: 0, z: 0, dead: false, hp: 100 });
    gameState.enemies.push({
      id: 'full',
      x: 0,
      z: 0,
      type: 'grunt',
      variant: 'frenzied',
      hp: 100,
      maxHp: 100,
      state: 'chasing',
      attackState: 'windup',
      windupTargetId: 'pFull',
      windupStartTime: now - baseWindup + 50,
      wanderTarget: { x: 0, z: 0 },
    });
    updateEnemies();
    expect(gameState.players.pFull.hp).toBe(100);

    resetState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2000, 0, 1));

    addPlayer('pEnraged', { id: 'pEnraged', x: 0, z: 0, dead: false, hp: 100 });
    gameState.enemies.push({
      id: 'enraged',
      x: 0,
      z: 0,
      type: 'grunt',
      variant: 'frenzied',
      hp: 40,
      maxHp: 100,
      state: 'chasing',
      attackState: 'windup',
      windupTargetId: 'pEnraged',
      windupStartTime: now - baseWindup * enragedMult - 100,
      wanderTarget: { x: 0, z: 0 },
    });
    updateEnemies();
    expect(gameState.players.pEnraged.hp).toBeLessThan(100);
  });
});
