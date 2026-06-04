import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyFrenziedEnrage,
  FRENZIED_CHASE_SPEED_MULT,
  FRENZIED_ATTACK_SPEED_MULT,
} from '../enemyVariants.js';
import { ATTACK_RANGE, DETECTION_RADIUS, TICK_RATE } from '../config.js';
import {
  ENEMY_DEFS,
  updateEnemies,
  updateMinions,
  collectRadialHits,
  resetGameState,
  gameState,
} from '../index.js';

function makeFrenziedGrunt(overrides = {}) {
  return {
    id: 'frenzied-grunt',
    type: 'grunt',
    variant: 'frenzied',
    maxHp: 100,
    hp: 100,
    x: DETECTION_RADIUS - 1,
    z: 0,
    state: 'idle',
    attackState: 'idle',
    wanderTarget: { x: 10, z: 10 },
    ...overrides,
  };
}

describe('frenzied enrage', () => {
  beforeEach(() => resetGameState());

  it('leaves base speeds untouched above half HP', () => {
    const enemy = makeFrenziedGrunt({ hp: 60, maxHp: 100 });
    applyFrenziedEnrage(enemy);

    expect(enemy.frenziedEnraged).toBeUndefined();
    expect(enemy.chaseSpeed).toBeUndefined();
    expect(enemy.attackWindupMs).toBeUndefined();
  });

  it('boosts chase speed and lowers attack windup at or below half HP', () => {
    const base = ENEMY_DEFS.grunt;
    const enemy = makeFrenziedGrunt({ hp: 50, maxHp: 100 });
    applyFrenziedEnrage(enemy);

    expect(enemy.frenziedEnraged).toBe(true);
    expect(enemy.chaseSpeed).toBeGreaterThan(base.chaseSpeed);
    expect(enemy.chaseSpeed).toBe(base.chaseSpeed * FRENZIED_CHASE_SPEED_MULT);
    expect(enemy.attackWindupMs).toBeLessThan(base.attackWindupMs);
    expect(enemy.attackWindupMs).toBe(
      Math.round(base.attackWindupMs / FRENZIED_ATTACK_SPEED_MULT)
    );
  });

  it('latches enrage when HP heals above half later', () => {
    const base = ENEMY_DEFS.grunt;
    const enemy = makeFrenziedGrunt({ hp: 40, maxHp: 100 });
    applyFrenziedEnrage(enemy);
    expect(enemy.frenziedEnraged).toBe(true);

    enemy.hp = 90;
    applyFrenziedEnrage(enemy);

    expect(enemy.frenziedEnraged).toBe(true);
    expect(enemy.chaseSpeed).toBe(base.chaseSpeed * FRENZIED_CHASE_SPEED_MULT);
    expect(enemy.attackWindupMs).toBe(
      Math.round(base.attackWindupMs / FRENZIED_ATTACK_SPEED_MULT)
    );
  });

  it('no-ops when maxHp is missing', () => {
    const enemy = makeFrenziedGrunt({ hp: 10, maxHp: undefined });
    applyFrenziedEnrage(enemy);

    expect(enemy.frenziedEnraged).toBeUndefined();
    expect(enemy.chaseSpeed).toBeUndefined();
  });

  it('does not enrage plain grunts', () => {
    const enemy = makeFrenziedGrunt({ variant: null, hp: 10, maxHp: 100 });
    applyFrenziedEnrage(enemy);

    expect(enemy.frenziedEnraged).toBeUndefined();
    expect(enemy.chaseSpeed).toBeUndefined();
  });

  it('recomputes enrage after minion melee drops HP below half', () => {
    const base = ENEMY_DEFS.grunt;
    const enemy = makeFrenziedGrunt({ hp: 60, maxHp: 100, x: 0, z: 0 });
    gameState.gamePhase = 'playing';
    gameState.run = { status: 'playing' };
    gameState.players = {
      p1: { id: 'p1', hp: 100, dead: false, x: 0, z: 0 },
    };
    gameState.enemies = [enemy];
    gameState.minions = [{
      id: 'ag-1',
      ownerId: 'p1',
      type: 'astral_guardian',
      x: 0,
      z: 0,
      hp: 60,
      maxHp: 60,
      ttl: 30,
      attackDamage: 11,
      attackIntervalMs: 0,
      lastAttackAt: 0,
    }];

    const dist = Math.hypot(enemy.x, enemy.z);
    expect(dist).toBeLessThanOrEqual(ATTACK_RANGE);

    updateMinions();

    expect(enemy.hp).toBe(49);
    expect(enemy.frenziedEnraged).toBe(true);
    expect(enemy.chaseSpeed).toBe(base.chaseSpeed * FRENZIED_CHASE_SPEED_MULT);
  });

  it('recomputes enrage after radial damage drops HP below half', () => {
    const base = ENEMY_DEFS.grunt;
    const enemy = makeFrenziedGrunt({ hp: 60, maxHp: 100, x: 0, z: 0 });
    gameState.enemies.push(enemy);

    collectRadialHits(0, 0, 5, 15);

    expect(enemy.hp).toBe(45);
    expect(enemy.frenziedEnraged).toBe(true);
    expect(enemy.chaseSpeed).toBe(base.chaseSpeed * FRENZIED_CHASE_SPEED_MULT);
  });

  it('moves farther per tick when enraged vs base grunt', () => {
    const dt = 1 / TICK_RATE;
    const player = {
      id: 'p1',
      x: 0,
      z: 0,
      dead: false,
      extracted: false,
    };
    gameState.players = { p1: player };

    const baseEnemy = makeFrenziedGrunt({
      id: 'base-grunt',
      variant: null,
      hp: 40,
      x: DETECTION_RADIUS - 1,
      z: 0,
    });
    const frenziedEnemy = makeFrenziedGrunt({
      id: 'frenzied-grunt',
      hp: 40,
      maxHp: 100,
      x: DETECTION_RADIUS - 1,
      z: 0,
    });
    applyFrenziedEnrage(frenziedEnemy);

    gameState.enemies = [baseEnemy];
    const baseXBefore = baseEnemy.x;
    updateEnemies();
    const baseMove = Math.abs(baseEnemy.x - baseXBefore);

    gameState.enemies = [frenziedEnemy];
    const frenziedXBefore = frenziedEnemy.x;
    updateEnemies();
    const frenziedMove = Math.abs(frenziedEnemy.x - frenziedXBefore);

    expect(frenziedMove).toBeGreaterThan(baseMove);
    expect(frenziedMove).toBeCloseTo(ENEMY_DEFS.grunt.chaseSpeed * FRENZIED_CHASE_SPEED_MULT * dt, 5);
  });
});
