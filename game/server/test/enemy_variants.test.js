import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../dungeon';
import {
  VARIANT_DEFS,
  BASE_VARIANT_CHANCE,
  QUEST_TIER_1_VARIANT_SCALE,
  QUEST_TIER_2_VARIANT_BASE,
  resolveVariantRollTier,
  pickVariant,
  applyVariant,
} from '../enemyVariants';

// Deterministic rng stub returning a fixed sequence (looping).
function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

const DISPLAY_ONLY_KEYS = ['id', 'name', 'description', 'surfacedStats', 'apply'];

// Runtime enemy fields set by apply() rather than static registry keys.
const COMPOSITE_SURFACED_STATS = {
  warded: ['shieldHp', 'maxShieldHp'],
};

describe('VARIANT_DEFS display metadata', () => {
  for (const id of Object.keys(VARIANT_DEFS)) {
    it(`${id} has non-empty name, description, and valid surfacedStats`, () => {
      const def = VARIANT_DEFS[id];
      expect(typeof def.name).toBe('string');
      expect(def.name.length).toBeGreaterThan(0);

      expect(typeof def.description).toBe('string');
      expect(def.description.length).toBeGreaterThan(0);

      expect(Array.isArray(def.surfacedStats)).toBe(true);
      expect(def.surfacedStats.length).toBeGreaterThan(0);

      const composite = new Set(COMPOSITE_SURFACED_STATS[id] ?? []);
      const statKeys = Object.keys(def).filter((k) => !DISPLAY_ONLY_KEYS.includes(k));
      for (const statKey of def.surfacedStats) {
        expect(typeof statKey).toBe('string');
        expect(composite.has(statKey) || statKeys.includes(statKey)).toBe(true);
      }
    });
  }
});

describe('enemy variant registry', () => {
  it('exposes a trivial no-op test variant', () => {
    expect(VARIANT_DEFS.test).toBeDefined();
    expect(VARIANT_DEFS.test.id).toBe('test');
    expect(typeof VARIANT_DEFS.test.name).toBe('string');
    // No-op behavior in this ticket: no apply function wired up yet.
    expect(VARIANT_DEFS.test.apply).toBeNull();
  });
});

describe('resolveVariantRollTier', () => {
  it('maps Tier 1 to near-zero roll tier scaled by encounterTier', () => {
    expect(resolveVariantRollTier(1, 0)).toBe(0);
    expect(resolveVariantRollTier(1, 0.8)).toBeCloseTo(0.8 * QUEST_TIER_1_VARIANT_SCALE);
    expect(resolveVariantRollTier(1, 1)).toBeCloseTo(QUEST_TIER_1_VARIANT_SCALE);
  });

  it('maps Tier 2 to full roll tier even when encounterTier is 0', () => {
    expect(resolveVariantRollTier(2, 0)).toBe(QUEST_TIER_2_VARIANT_BASE);
    expect(resolveVariantRollTier(2, 0.5)).toBe(QUEST_TIER_2_VARIANT_BASE);
  });

  it('defaults invalid quest tiers to Tier 1 scaling', () => {
    expect(resolveVariantRollTier(undefined, 0.5)).toBeCloseTo(0.5 * QUEST_TIER_1_VARIANT_SCALE);
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

  it('invokes the variant definition apply hook when a variant is selected', () => {
    // Temporarily register a def with a function `apply` so we can prove the
    // hook fires for tagged enemies; restore the registry afterwards.
    const ids = Object.keys(VARIANT_DEFS);
    const spied = ids.map((id) => {
      const def = VARIANT_DEFS[id];
      const original = def.apply;
      def.apply = (enemy) => {
        enemy.hookRan = true;
        enemy.maxHp = 999;
      };
      return { def, original };
    });
    try {
      // First draw < chance (tagged); second draw selects an id.
      const enemy = {};
      applyVariant(enemy, 1, seqRng([0.01, 0]));
      expect(enemy.variant).not.toBeNull();
      expect(enemy.hookRan).toBe(true);
      expect(enemy.maxHp).toBe(999);
    } finally {
      spied.forEach(({ def, original }) => {
        def.apply = original;
      });
    }
  });

  it('does not invoke any apply hook for an untagged enemy', () => {
    const ids = Object.keys(VARIANT_DEFS);
    const spied = ids.map((id) => {
      const def = VARIANT_DEFS[id];
      const original = def.apply;
      def.apply = (enemy) => {
        enemy.hookRan = true;
      };
      return { def, original };
    });
    try {
      // Roll above the scaled chance => no tag, so no hook should fire.
      const enemy = {};
      applyVariant(enemy, 1, seqRng([BASE_VARIANT_CHANCE + 0.01]));
      expect(enemy.variant).toBeNull();
      expect(enemy.hookRan).toBeUndefined();
    } finally {
      spied.forEach(({ def, original }) => {
        def.apply = original;
      });
    }
  });

  it('leaves enemy stats unchanged when the no-op test variant is selected', () => {
    // The shipped 'test' variant has apply: null, so selecting it must not
    // mutate the enemy beyond the variant tag. Directly target the 'test'
    // variant by id instead of relying on object-key ordering.
    expect(VARIANT_DEFS.test.apply).toBeNull();
    const enemy = { maxHp: 100, hp: 100, atk: 7 };
    enemy.variant = 'test';
    // Simulate what applyVariant does: invoke def.apply if it is a function.
    const def = VARIANT_DEFS[enemy.variant];
    if (def && typeof def.apply === 'function') {
      def.apply(enemy);
    }
    expect(enemy.variant).toBe('test');
    expect(enemy.maxHp).toBe(100);
    expect(enemy.hp).toBe(100);
    expect(enemy.atk).toBe(7);
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
