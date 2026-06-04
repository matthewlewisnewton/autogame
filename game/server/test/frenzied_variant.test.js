import { describe, it, expect } from 'vitest';
import {
  VARIANT_DEFS,
  FRENZIED_HP_THRESHOLD,
  FRENZIED_SPEED_MULT,
  isFrenziedActive,
  getEffectiveEnemyCombatStats,
} from '../enemyVariants.js';
import { ENEMY_DEFS } from '../simulation.js';

const gruntBase = ENEMY_DEFS.grunt;

describe('frenzied variant registry', () => {
  it('defines frenzied with threshold, speed mult, and bonusDrop', () => {
    expect(VARIANT_DEFS.frenzied).toBeDefined();
    expect(VARIANT_DEFS.frenzied.id).toBe('frenzied');
    expect(typeof VARIANT_DEFS.frenzied.name).toBe('string');
    expect(VARIANT_DEFS.frenzied.apply).toBeNull();
    expect(VARIANT_DEFS.frenzied.hpThreshold).toBe(FRENZIED_HP_THRESHOLD);
    expect(VARIANT_DEFS.frenzied.speedMult).toBe(FRENZIED_SPEED_MULT);
    expect(VARIANT_DEFS.frenzied.bonusDrop).toEqual({ card: true, magicStone: 15 });
    expect(FRENZIED_HP_THRESHOLD).toBe(0.5);
    expect(FRENZIED_SPEED_MULT).toBe(1.5);
  });
});

describe('isFrenziedActive', () => {
  it('is true for frenzied enemies strictly below half HP', () => {
    expect(isFrenziedActive({ variant: 'frenzied', hp: 49, maxHp: 100 })).toBe(true);
  });

  it('is false at or above half HP, when dead, or for other variants', () => {
    expect(isFrenziedActive({ variant: 'frenzied', hp: 50, maxHp: 100 })).toBe(false);
    expect(isFrenziedActive({ variant: 'frenzied', hp: 80, maxHp: 100 })).toBe(false);
    expect(isFrenziedActive({ variant: 'frenzied', hp: 0, maxHp: 100 })).toBe(false);
    expect(isFrenziedActive({ variant: null, hp: 10, maxHp: 100 })).toBe(false);
    expect(isFrenziedActive({ variant: 'leeching', hp: 10, maxHp: 100 })).toBe(false);
  });
});

describe('getEffectiveEnemyCombatStats', () => {
  it('boosts chase speed and shortens windup below the HP threshold', () => {
    const enemy = { variant: 'frenzied', hp: 40, maxHp: 100 };
    const stats = getEffectiveEnemyCombatStats(enemy, gruntBase);

    expect(stats.chaseSpeed).toBeGreaterThan(gruntBase.chaseSpeed);
    expect(stats.attackWindupMs).toBeLessThan(gruntBase.attackWindupMs);
    expect(stats.chaseSpeed).toBe(gruntBase.chaseSpeed * FRENZIED_SPEED_MULT);
    expect(stats.attackWindupMs).toBe(Math.floor(gruntBase.attackWindupMs / FRENZIED_SPEED_MULT));
  });

  it('returns base stats at or above half HP for frenzied enemies', () => {
    const enemy = { variant: 'frenzied', hp: 50, maxHp: 100 };
    const stats = getEffectiveEnemyCombatStats(enemy, gruntBase);

    expect(stats.chaseSpeed).toBe(gruntBase.chaseSpeed);
    expect(stats.attackWindupMs).toBe(gruntBase.attackWindupMs);
  });

  it('returns base stats for non-frenzied enemies at low HP', () => {
    const enemy = { variant: 'leeching', hp: 10, maxHp: 100 };
    const stats = getEffectiveEnemyCombatStats(enemy, gruntBase);

    expect(stats.chaseSpeed).toBe(gruntBase.chaseSpeed);
    expect(stats.attackWindupMs).toBe(gruntBase.attackWindupMs);
  });

  it('removes boost when HP heals above the threshold', () => {
    const enemy = { variant: 'frenzied', hp: 40, maxHp: 100 };
    const boosted = getEffectiveEnemyCombatStats(enemy, gruntBase);
    enemy.hp = 60;
    const healed = getEffectiveEnemyCombatStats(enemy, gruntBase);

    expect(boosted.chaseSpeed).toBeGreaterThan(healed.chaseSpeed);
    expect(boosted.attackWindupMs).toBeLessThan(healed.attackWindupMs);
    expect(healed.chaseSpeed).toBe(gruntBase.chaseSpeed);
    expect(healed.attackWindupMs).toBe(gruntBase.attackWindupMs);
  });
});
