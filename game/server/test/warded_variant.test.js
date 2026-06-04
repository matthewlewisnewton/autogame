import { describe, it, expect } from 'vitest';
import {
  VARIANT_DEFS,
  BASE_VARIANT_CHANCE,
  applyVariant,
} from '../enemyVariants';

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
    // First roll tags (below tier-1 chance); second roll picks index 1 (warded).
    applyVariant(enemy, 1, seqRng([0.01, 0.6]));
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
    applyVariant(enemy, 1, seqRng([0.01, 0]));
    expect(enemy.variant).toBe('test');
    expect(enemy.shieldHp === undefined || enemy.shieldHp === 0).toBe(true);
  });
});
