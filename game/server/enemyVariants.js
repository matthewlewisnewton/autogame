// ── Enemy Variant Registry + applyVariant Seam ──
// Data + seam for enemy variants (affixes). This ticket is plumbing only:
// the single 'test' variant is a behavioral no-op (it does not change enemy
// stats/AI). Follow-up tickets 170–173 extend VARIANT_DEFS with real effects
// without touching the applyVariant seam below.

// Fraction of player HP actually removed that a Leeching attacker heals (floor).
const LEECH_FRACTION = 0.25;

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
  volatile: {
    id: 'volatile',
    name: 'Volatile',
    // No stat/AI mutation on spawn; the variant's behavior is an on-death
    // radial explosion resolved by the simulation (spawnVolatileExplosion +
    // the 'volatile_explosion' branch of updateAreaEffects).
    apply: null,
    // Explosion tuning consumed when a tagged enemy dies: every player, minion,
    // and living enemy within `radius` of the corpse takes `damage`.
    radius: 5,
    damage: 20,
    bonusDrop: { magicStone: 10 },
  },
  warded: {
    id: 'warded',
    name: 'Warded',
    apply(enemy) {
      const maxShieldHp = Math.max(20, Math.round((enemy.maxHp || enemy.hp || 0) * 0.4));
      enemy.maxShieldHp = maxShieldHp;
      enemy.shieldHp = maxShieldHp;
    },
    bonusDrop: { card: true, magicStone: 20 },
  },
  leeching: {
    id: 'leeching',
    name: 'Leeching',
    apply: null,
    leechFraction: LEECH_FRACTION,
    bonusDrop: { card: true, magicStone: 15 },
  },
  frenzied: {
    id: 'frenzied',
    name: 'Frenzied',
    // No stat mutation on spawn; chase speed and attack wind-up scale up once
    // HP drops below 50% (see getFrenziedCombatMultipliers + updateEnemies).
    apply: null,
    // Multipliers applied while enraged (hp < maxHp * 0.5).
    chaseSpeedMult: 1.5,
    attackWindupMult: 0.5,
    bonusDrop: { card: true, magicStone: 15 },
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
 * Pick a single variant id from `ids` using `rng`.
 *
 * Calls `rng()` once (falling back to `Math.random()` when `rng` is not a
 * function) and returns the selected id.  Safe when `ids` is empty — returns
 * `undefined` in that edge case (the caller never passes an empty array).
 *
 * Exported so tests can stub or bypass the index-mapping and assert membership
 * + effect rather than relying on `rng() * N` landing on a specific position.
 */
function pickVariant(rng, ids) {
  const pick = typeof rng === 'function' ? rng() : Math.random();
  return ids[Math.min(ids.length - 1, Math.floor(pick * ids.length))];
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
    const id = pickVariant(rng, ids);
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
 * Heal a Leeching attacker for floor(leechFraction * damageDealt) HP, capped at
 * maxHp. `damageDealt` is the amount actually applied to the player (post-
 * mitigation), not the raw incoming hit. No-op when the attacker is missing,
 * dead, or not Leeching-tagged, or when damageDealt <= 0.
 *
 * @returns {number} HP actually restored (0 when no heal).
 */
const FRENZIED_ENRAGE_HP_FRACTION = 0.5;

/**
 * Combat multipliers for a Frenzied enemy. Returns `{ chaseSpeedMult, attackWindupMult }`
 * (both `1` when not enraged). Enraged when `variant === 'frenzied'` and
 * `hp < maxHp * 0.5`.
 */
function getFrenziedCombatMultipliers(enemy) {
  if (!enemy || enemy.variant !== 'frenzied') {
    return { chaseSpeedMult: 1, attackWindupMult: 1 };
  }

  const maxHp = Number.isFinite(enemy.maxHp) ? enemy.maxHp : enemy.hp;
  if (!Number.isFinite(maxHp) || maxHp <= 0 || enemy.hp >= maxHp * FRENZIED_ENRAGE_HP_FRACTION) {
    return { chaseSpeedMult: 1, attackWindupMult: 1 };
  }

  const def = VARIANT_DEFS.frenzied;
  return {
    chaseSpeedMult: def?.chaseSpeedMult ?? 1,
    attackWindupMult: def?.attackWindupMult ?? 1,
  };
}

function applyLeechHeal(attackerEnemyId, damageDealt, enemies) {
  if (!attackerEnemyId || damageDealt <= 0 || !Array.isArray(enemies)) return 0;

  const enemy = enemies.find((e) => e.id === attackerEnemyId && e.hp > 0);
  if (!enemy || enemy.variant !== 'leeching') return 0;

  const def = VARIANT_DEFS.leeching;
  const fraction = def?.leechFraction ?? LEECH_FRACTION;
  const heal = Math.floor(fraction * damageDealt);
  if (heal <= 0) return 0;

  const cap = Number.isFinite(enemy.maxHp) ? enemy.maxHp : enemy.hp + heal;
  const before = enemy.hp;
  enemy.hp = Math.min(cap, enemy.hp + heal);
  return enemy.hp - before;
}

module.exports = {
  VARIANT_DEFS,
  LEECH_FRACTION,
  FRENZIED_ENRAGE_HP_FRACTION,
  BASE_VARIANT_CHANCE,
  TIER_CHANCE_SCALE,
  pickVariant,
  applyVariant,
  getVariantBonusDrop,
  getFrenziedCombatMultipliers,
  applyLeechHeal,
};
