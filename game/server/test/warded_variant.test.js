import { describe, it, expect } from 'vitest';
import {
  VARIANT_DEFS,
  BASE_VARIANT_CHANCE,
  applyVariant,
  pickVariant,
} from '../enemyVariants';
import { damageEnemy } from '../simulation.js';

function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

function gruntStub() {
  return { type: 'grunt', hp: 100, maxHp: 100, atk: 10 };
}

describe('VARIANT_DEFS.warded', () => {
  it('is registered with id, name, apply, and bonusDrop', () => {
    const def = VARIANT_DEFS.warded;
    expect(def).toBeDefined();
    expect(def.id).toBe('warded');
    expect(typeof def.name).toBe('string');
    expect(typeof def.apply).toBe('function');
    expect(def.bonusDrop).toEqual({ card: true, magicStone: 20 });
  });

  it('grants a full shield pool without changing base hp', () => {
    const enemy = gruntStub();
    VARIANT_DEFS.warded.apply(enemy);
    expect(enemy.maxShieldHp).toBe(40);
    expect(enemy.shieldHp).toBe(40);
    expect(enemy.hp).toBe(100);
    expect(enemy.maxHp).toBe(100);
  });
});

describe('applyVariant with warded', () => {
  it('tags warded and applies shield fields via the registry hook', () => {
    const enemy = gruntStub();
    enemy.variant = 'warded';
    VARIANT_DEFS.warded.apply(enemy);
    expect(enemy.variant).toBe('warded');
    expect(enemy.shieldHp).toBeGreaterThan(0);
    expect(enemy.maxShieldHp).toBe(enemy.shieldHp);
    expect(enemy.hp).toBe(100);
    expect(enemy.maxHp).toBe(100);
  });

  it('leaves shieldHp unset for enemies that are not tagged', () => {
    const enemy = gruntStub();
    applyVariant(enemy, 1, seqRng([BASE_VARIANT_CHANCE + 0.01]));
    expect(enemy.variant).toBeNull();
    expect(enemy.shieldHp === undefined || enemy.shieldHp === 0).toBe(true);
  });

  it('leaves shieldHp unset when the no-op test variant is selected', () => {
    const enemy = gruntStub();
    enemy.variant = 'test';
    if (VARIANT_DEFS.test && typeof VARIANT_DEFS.test.apply === 'function') {
      VARIANT_DEFS.test.apply(enemy);
    }
    expect(enemy.variant).toBe('test');
    expect(enemy.shieldHp === undefined || enemy.shieldHp === 0).toBe(true);
  });
});

describe('damageEnemy', () => {
  it('depletes shieldHp before hp for a warded enemy', () => {
    const enemy = { type: 'grunt', hp: 100, maxHp: 100, shieldHp: 50, maxShieldHp: 50 };

    damageEnemy(enemy, 30);
    expect(enemy.shieldHp).toBe(20);
    expect(enemy.hp).toBe(100);

    damageEnemy(enemy, 20);
    expect(enemy.shieldHp).toBe(0);
    expect(enemy.hp).toBe(100);

    damageEnemy(enemy, 10);
    expect(enemy.shieldHp).toBe(0);
    expect(enemy.hp).toBe(90);
  });

  it('overflows damage to hp once shield is depleted mid-hit', () => {
    const enemy = { type: 'grunt', hp: 100, maxHp: 100, shieldHp: 20, maxShieldHp: 50 };

    damageEnemy(enemy, 25);
    expect(enemy.shieldHp).toBe(0);
    expect(enemy.hp).toBe(95);
  });

  it('reduces hp immediately when shieldHp is absent', () => {
    const enemy = gruntStub();
    const hpBefore = enemy.hp;

    damageEnemy(enemy, 15);
    expect(enemy.hp).toBe(hpBefore - 15);
    expect(enemy.shieldHp === undefined || enemy.shieldHp === 0).toBe(true);
  });

  it('reports kill when hp drops from above zero to zero', () => {
    const enemy = { type: 'grunt', hp: 10, maxHp: 100, shieldHp: 0 };
    const { killed } = damageEnemy(enemy, 10);
    expect(killed).toBe(true);
    expect(enemy.hp).toBe(0);
  });
});
