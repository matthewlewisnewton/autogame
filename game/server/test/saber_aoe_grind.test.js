import { describe, it, expect } from 'vitest';
import { CARD_DEFS } from '../index.js';
import { effectiveAttackRange } from '../cardEffects.js';
import { ATTACK_RANGE } from '../config.js';

describe('saber_of_light AoE-per-grind scaling', () => {
  const saber = CARD_DEFS.saber_of_light;

  it('keeps damage and cooldown unchanged', () => {
    expect(saber.damage).toBe(12);
    expect(saber.cooldownMs).toBe(400);
  });

  it('declares an explicit base attack reach and a small AoE grind scale', () => {
    expect(saber.attackRange).toBe(5);
    expect(saber.attackRange).toBe(ATTACK_RANGE);
    expect(saber.aoeGrindScale).toBeGreaterThan(0);
    // Conservative: well under 5% per grind level.
    expect(saber.aoeGrindScale).toBeLessThanOrEqual(0.05);
  });

  it('effective reach grows with grind but stays gentle', () => {
    const g0 = effectiveAttackRange(saber, 0);
    const g1 = effectiveAttackRange(saber, 1);
    const g5 = effectiveAttackRange(saber, 5);

    // grind 0 uses the base reach exactly.
    expect(g0).toBe(saber.attackRange);
    // Strictly larger at higher grind.
    expect(g5).toBeGreaterThan(g0);
    expect(g1).toBeGreaterThan(g0);
    // Per-level growth is small (no large jumps): each step under 5% of base.
    expect(g1 - g0).toBeLessThan(saber.attackRange * 0.05);
    // Even at grind 5 the total growth is modest (under ~20% of base).
    expect(g5).toBeLessThan(saber.attackRange * 1.2);
    // Smooth float, not rounded to an integer.
    expect(Number.isInteger(g5)).toBe(false);
  });

  it('does not apply AoE scaling to weapons lacking aoeGrindScale', () => {
    // photon_slicer is a control weapon with an explicit attackRange but no
    // aoeGrindScale, so its reach must not change with grind.
    const control = CARD_DEFS.photon_slicer;
    expect(control.aoeGrindScale).toBeUndefined();
    expect(effectiveAttackRange(control, 0)).toBe(control.attackRange);
    expect(effectiveAttackRange(control, 5)).toBe(control.attackRange);
  });

  it('falls back to ATTACK_RANGE for cards with no attackRange or scale', () => {
    const noRange = effectiveAttackRange({}, 5);
    expect(noRange).toBe(ATTACK_RANGE);
  });
});
