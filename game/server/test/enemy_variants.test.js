import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../dungeon';
import {
  VARIANT_DEFS,
  BASE_VARIANT_CHANCE,
  applyVariant,
} from '../enemyVariants';

// Deterministic rng stub returning a fixed sequence (looping).
function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('enemy variant registry', () => {
  it('exposes a trivial no-op test variant', () => {
    expect(VARIANT_DEFS.test).toBeDefined();
    expect(VARIANT_DEFS.test.id).toBe('test');
    expect(typeof VARIANT_DEFS.test.name).toBe('string');
    // No-op behavior in this ticket: no apply function wired up yet.
    expect(VARIANT_DEFS.test.apply).toBeNull();
  });
});

describe('applyVariant', () => {
  it('never tags an enemy at tier 0, even with the lowest possible roll', () => {
    // mulberry32-seeded run: at tier 0 the chance is 0, so no roll can tag.
    const rng = mulberry32(12345);
    for (let i = 0; i < 200; i++) {
      const enemy = {};
      applyVariant(enemy, 0, rng);
      expect(enemy.variant).toBeNull();
    }

    // A stub rng that always returns 0 (the lowest possible roll) still cannot
    // beat a zero chance.
    const enemy = {};
    applyVariant(enemy, 0, seqRng([0]));
    expect(enemy.variant).toBeNull();
  });

  it('tags an enemy with a registry variant id at high tier with a low roll', () => {
    // First draw < chance (0.25 at tier 1) => tagged; second draw selects id.
    const rng = seqRng([0.01, 0]);
    const enemy = {};
    applyVariant(enemy, 1, rng);
    expect(enemy.variant).not.toBeNull();
    expect(Object.keys(VARIANT_DEFS)).toContain(enemy.variant);
  });

  it('does not tag at high tier when the roll exceeds the scaled chance', () => {
    // chance at tier 1 is BASE_VARIANT_CHANCE; a roll above it leaves it untagged.
    const enemy = {};
    applyVariant(enemy, 1, seqRng([BASE_VARIANT_CHANCE + 0.01]));
    expect(enemy.variant).toBeNull();
  });

  it('leaves the variant field present (null) when not chosen', () => {
    const enemy = {};
    applyVariant(enemy, 0, seqRng([0]));
    expect('variant' in enemy).toBe(true);
    expect(enemy.variant).toBeNull();
  });

  it('produces a deterministic outcome for a fixed seed at high tier', () => {
    const tagCount = (seed) => {
      let tagged = 0;
      const rng = mulberry32(seed);
      for (let i = 0; i < 500; i++) {
        const enemy = {};
        applyVariant(enemy, 1, rng);
        if (enemy.variant) tagged++;
      }
      return tagged;
    };
    // Same seed => identical tag count; and at least some get tagged at tier 1.
    expect(tagCount(99)).toBe(tagCount(99));
    expect(tagCount(99)).toBeGreaterThan(0);
  });
});
