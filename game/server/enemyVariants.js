// ── Enemy Variant Registry + applyVariant Seam ──
// Data + seam for enemy variants (affixes). This ticket is plumbing only:
// the single 'test' variant is a behavioral no-op (it does not change enemy
// stats/AI). Follow-up tickets 170–173 extend VARIANT_DEFS with real effects
// without touching the applyVariant seam below.

// Registry: variant id → definition. Each def carries at least `id`, a human
// `name`, and an `apply` placeholder for future stat/AI behavior (null = no-op).
const VARIANT_DEFS = {
  test: {
    id: 'test',
    name: 'Test Variant',
    // Placeholder for future behavior. Null means no-op for this ticket.
    apply: null,
  },
};

// Base chance that any single enemy rolls a variant, before tier scaling.
// Tunable knob for follow-up tickets.
const BASE_VARIANT_CHANCE = 0.25;
// How the room's encounterTier (0–1) scales the base chance. With a scale of 1
// the effective chance ranges from 0 (tier 0) to BASE_VARIANT_CHANCE (tier 1).
const TIER_CHANCE_SCALE = 1;

// Ids eligible to be assigned when an enemy is tagged.
function variantIds() {
  return Object.keys(VARIANT_DEFS);
}

/**
 * Maybe tag `enemy` with a variant.
 *
 * Uses `rng` (a 0–1 generator, e.g. mulberry32) and a probability scaled by
 * `tier` (the spawn room's encounterTier, clamped to 0–1) to decide whether to
 * tag the enemy. When chosen, `enemy.variant` is set to a variant id from the
 * registry; when not chosen, `enemy.variant` is left null so the field is always
 * present on the serialized enemy.
 *
 * @returns the (possibly mutated) enemy.
 */
function applyVariant(enemy, tier, rng) {
  if (!enemy) return enemy;

  const roll = typeof rng === 'function' ? rng() : Math.random();
  const t = Number.isFinite(tier) ? Math.max(0, Math.min(1, tier)) : 0;
  const chance = BASE_VARIANT_CHANCE * TIER_CHANCE_SCALE * t;

  if (chance > 0 && roll < chance) {
    const ids = variantIds();
    const pick = typeof rng === 'function' ? rng() : Math.random();
    const id = ids[Math.min(ids.length - 1, Math.floor(pick * ids.length))];
    enemy.variant = id;
  } else if (enemy.variant === undefined) {
    enemy.variant = null;
  }

  return enemy;
}

module.exports = {
  VARIANT_DEFS,
  BASE_VARIANT_CHANCE,
  TIER_CHANCE_SCALE,
  applyVariant,
};
