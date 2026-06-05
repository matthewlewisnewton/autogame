import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VARIANT_DEFS,
  FRENZIED_ENRAGE_HP_FRACTION,
  FRENZIED_TELEGRAPH_MS,
  getFrenziedCombatMultipliers,
  checkFrenziedTelegraph,
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
    // Set expired telegraph so the enemy is past the telegraph window and
    // already receiving boosted multipliers (simulating post-telegraph state).
    gameState.enemies.push(
      makeChasingGrunt({
        id: 'enraged',
        variant: 'frenzied',
        hp: 40,
        maxHp: 100,
        x: startDist,
        enrageTelegraphUntil: Date.now() - 1,
        frenziedEnrageTriggered: true,
      }),
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
      enrageTelegraphUntil: now - 1, // past telegraph window — already enraged
      frenziedEnrageTriggered: true,
    });
    updateEnemies();
    expect(gameState.players.pEnraged.hp).toBeLessThan(100);
  });
});

describe('FRENZIED_TELEGRAPH_MS', () => {
  it('is 1500 ms', () => {
    expect(FRENZIED_TELEGRAPH_MS).toBe(1500);
  });
});

describe('checkFrenziedTelegraph', () => {
  it('arms telegraph when HP drops to/at/below 50% maxHp', () => {
    const enemy = { variant: 'frenzied', hp: 49, maxHp: 100 };
    const now = Date.now();
    checkFrenziedTelegraph(enemy, now);
    expect(enemy.enrageTelegraphUntil).toBe(now + FRENZIED_TELEGRAPH_MS);
  });

  it('arms telegraph when HP is exactly at 50% maxHp', () => {
    const enemy = { variant: 'frenzied', hp: 50, maxHp: 100 };
    const now = Date.now();
    checkFrenziedTelegraph(enemy, now);
    expect(enemy.enrageTelegraphUntil).toBe(now + FRENZIED_TELEGRAPH_MS);
  });

  it('does NOT arm telegraph when HP is above 50%', () => {
    const enemy = { variant: 'frenzied', hp: 51, maxHp: 100 };
    const now = Date.now();
    checkFrenziedTelegraph(enemy, now);
    expect(enemy.enrageTelegraphUntil).toBeUndefined();
  });

  it('is a no-op for non-frenzied enemies', () => {
    const enemy = { variant: 'volatile', hp: 10, maxHp: 100 };
    checkFrenziedTelegraph(enemy, Date.now());
    expect(enemy.enrageTelegraphUntil).toBeUndefined();
  });

  it('is idempotent — does not re-arm an active telegraph', () => {
    const enemy = { variant: 'frenzied', hp: 40, maxHp: 100 };
    const t0 = Date.now();
    checkFrenziedTelegraph(enemy, t0);
    const first = enemy.enrageTelegraphUntil;

    // Calling again with a later timestamp should NOT overwrite
    checkFrenziedTelegraph(enemy, t0 + 500);
    expect(enemy.enrageTelegraphUntil).toBe(first);
  });

  it('does NOT re-arm after telegraph expires (one-shot enrage)', () => {
    const enemy = { variant: 'frenzied', hp: 40, maxHp: 100 };
    const t0 = Date.now();
    checkFrenziedTelegraph(enemy, t0);
    expect(enemy.frenziedEnrageTriggered).toBe(true);
    const first = enemy.enrageTelegraphUntil;

    // After telegraph expires, re-check should NOT arm a new telegraph
    const t1 = first + 100;
    checkFrenziedTelegraph(enemy, t1);
    expect(enemy.enrageTelegraphUntil).toBe(first); // unchanged
  });
});

describe('getFrenziedCombatMultipliers — telegraph window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2000, 0, 1));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns neutral multipliers during telegraph window', () => {
    const now = Date.now();
    const enemy = {
      variant: 'frenzied',
      hp: 40,
      maxHp: 100,
      enrageTelegraphUntil: now + FRENZIED_TELEGRAPH_MS,
    };
    expect(getFrenziedCombatMultipliers(enemy)).toEqual({
      chaseSpeedMult: 1,
      attackWindupMult: 1,
    });
  });

  it('returns boosted multipliers after telegraph expires', () => {
    const now = Date.now();
    const enemy = {
      variant: 'frenzied',
      hp: 40,
      maxHp: 100,
      enrageTelegraphUntil: now - 1, // expired
    };
    expect(getFrenziedCombatMultipliers(enemy)).toEqual({
      chaseSpeedMult: VARIANT_DEFS.frenzied.chaseSpeedMult,
      attackWindupMult: VARIANT_DEFS.frenzied.attackWindupMult,
    });
  });

  it('returns boosted multipliers when no telegraph timer set (backward compat)', () => {
    const enemy = {
      variant: 'frenzied',
      hp: 40,
      maxHp: 100,
      // enrageTelegraphUntil not set
    };
    expect(getFrenziedCombatMultipliers(enemy)).toEqual({
      chaseSpeedMult: VARIANT_DEFS.frenzied.chaseSpeedMult,
      attackWindupMult: VARIANT_DEFS.frenzied.attackWindupMult,
    });
  });
});

describe('frenzied telegraph in updateEnemies()', () => {
  beforeEach(() => {
    resetState();
  });

  it('frenzied enemy below 50% does NOT speed up during telegraph window', () => {
    const startDist = DETECTION_RADIUS - 1;

    // First tick: telegraph arms, enemy moves at neutral speed
    addPlayer('p1', { x: 0, z: 0, dead: false });
    gameState.enemies.push(
      makeChasingGrunt({ id: 'telegraph', variant: 'frenzied', hp: 49, maxHp: 100, x: startDist }),
    );
    const xBefore = gameState.enemies[0].x;
    updateEnemies();
    const telegraphMoved = Math.abs(xBefore - gameState.enemies[0].x);
    // Telegraph should be armed
    expect(gameState.enemies[0].enrageTelegraphUntil).toBeDefined();

    // Second tick: manually expire telegraph + mark enrage triggered, enemy moves faster
    gameState.enemies[0].enrageTelegraphUntil = Date.now() - 1;
    const xAfterTelegraph = gameState.enemies[0].x;
    updateEnemies();
    const postTelegraphMoved = Math.abs(xAfterTelegraph - gameState.enemies[0].x);

    expect(postTelegraphMoved).toBeGreaterThan(telegraphMoved);
  });

  it('enrageTelegraphUntil is set on enemy after crossing HP threshold', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2000, 0, 1));
    try {
      addPlayer('p1', { x: 0, z: 0, dead: false });
      const startDist = DETECTION_RADIUS - 1;
      // Start above threshold
      gameState.enemies.push(
        makeChasingGrunt({ id: 'e1', variant: 'frenzied', hp: 60, maxHp: 100, x: startDist }),
      );
      updateEnemies();
      expect(gameState.enemies[0].enrageTelegraphUntil).toBeUndefined();

      // Drop below threshold — frozen clock so Date.now() matches inside updateEnemies()
      gameState.enemies[0].hp = 49;
      const before = Date.now();
      updateEnemies();
      expect(gameState.enemies[0].enrageTelegraphUntil).toBe(before + FRENZIED_TELEGRAPH_MS);
    } finally {
      vi.useRealTimers();
    }
  });
});
