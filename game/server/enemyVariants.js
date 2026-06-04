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
    // Guaranteed bonus loot for enemies carrying this variant, consulted by the
    // loot path (recordEnemyCardDrop / spawnMagicStoneDrop). `card: true`
    // guarantees an extra copy of the enemy's normal card drop; `magicStone` is
    // the value of an additional magic-stone loot entry beyond the normal drop.
    bonusDrop: { card: true, magicStone: 15 },
  },
  frenzied: {
    id: 'frenzied',
    name: 'Frenzied',
    // Spawn-time no-op until sub-ticket 02 wires enrage runtime behavior.
    apply: null,
    // Same bonus-drop magnitudes as `test` (extra card + 15 magic stone).
    bonusDrop: { card: true, magicStone: 15 },
  },
};

// Frenzied enrage: below this HP fraction, chase/attack speed boosts latch on.
const FRENZIED_HP_THRESHOLD = 0.5;
// Multipliers applied to ENEMY_DEFS chaseSpeed / attackWindupMs once enraged.
const FRENZIED_CHASE_SPEED_MULT = 1.5;
const FRENZIED_ATTACK_SPEED_MULT = 1.5;

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
    // Invoke the variant definition's behavior hook so follow-up tickets can
    // modify the enemy's stats/AI through the registry. A null/absent `apply`
    // (as for the 'test' variant) leaves the enemy unchanged beyond the tag.
    const def = VARIANT_DEFS[id];
    if (def && typeof def.apply === 'function') {
      def.apply(enemy);
    }
  } else if (enemy.variant === undefined) {
    enemy.variant = null;
  }

  return enemy;
}

/**
 * Resolve the bonus-drop definition for an enemy, driven by the variant
 * registry rather than hard-coded at the call site. Returns the def's
 * `bonusDrop` object when the enemy carries a truthy variant whose registry
 * entry declares one, otherwise null (non-variant enemies are unaffected).
 */
function getVariantBonusDrop(enemy) {
  if (!enemy || !enemy.variant) return null;
  const def = VARIANT_DEFS[enemy.variant];
  return def && def.bonusDrop ? def.bonusDrop : null;
}

/**
 * Apply frenzied enrage overrides when a frenzied enemy crosses the HP threshold.
 * Latches on first trigger; healing above threshold does not revert boosts.
 * No-ops for non-frenzied enemies or when maxHp is missing/invalid.
 */
function applyFrenziedEnrage(enemy) {
  if (!enemy || enemy.variant !== 'frenzied' || enemy.hp <= 0) return enemy;

  const maxHp = enemy.maxHp;
  if (!Number.isFinite(maxHp) || maxHp <= 0) return enemy;

  const { ENEMY_DEFS } = require('./simulation');
  const def = ENEMY_DEFS[enemy.type] || ENEMY_DEFS.grunt;

  if (enemy.frenziedEnraged) {
    enemy.chaseSpeed = def.chaseSpeed * FRENZIED_CHASE_SPEED_MULT;
    enemy.attackWindupMs = Math.round(def.attackWindupMs / FRENZIED_ATTACK_SPEED_MULT);
    return enemy;
  }

  const hp = Number.isFinite(enemy.hp) ? enemy.hp : maxHp;
  if (hp > maxHp * FRENZIED_HP_THRESHOLD) return enemy;

  enemy.frenziedEnraged = true;
  enemy.chaseSpeed = def.chaseSpeed * FRENZIED_CHASE_SPEED_MULT;
  enemy.attackWindupMs = Math.round(def.attackWindupMs / FRENZIED_ATTACK_SPEED_MULT);
  return enemy;
}

module.exports = {
  VARIANT_DEFS,
  BASE_VARIANT_CHANCE,
  TIER_CHANCE_SCALE,
  FRENZIED_HP_THRESHOLD,
  FRENZIED_CHASE_SPEED_MULT,
  FRENZIED_ATTACK_SPEED_MULT,
  applyVariant,
  getVariantBonusDrop,
  applyFrenziedEnrage,
};
