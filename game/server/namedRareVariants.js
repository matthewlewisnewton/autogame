// ── Named rare variant plumbing (scripted quest spawns) ──

/**
 * @typedef {Object} NamedRareVariantConfig
 * @property {string} name
 * @property {number} [hpMult]
 * @property {number} [damageMult]
 * @property {string} [tint]
 * @property {number} [scaleMult]
 * @property {{ cardId?: string, currency?: number }} drop
 */

/**
 * @typedef {Object} NamedRareSnapshot
 * @property {string} id
 * @property {string} name
 * @property {string} [tint]
 * @property {number} [scaleMult]
 * @property {{ cardId?: string, currency?: number }} drop
 */

function slugFromName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate and normalize an inline named-rare variant on a quest script spawn.
 * @param {unknown} variant
 * @returns {NamedRareVariantConfig | null}
 */
function normalizeNamedRareVariant(variant) {
  if (!variant || typeof variant !== 'object') {
    return null;
  }
  if (typeof variant.name !== 'string' || !variant.name.trim()) {
    return null;
  }

  const drop = variant.drop;
  if (!drop || typeof drop !== 'object') {
    return null;
  }

  const hasCard = typeof drop.cardId === 'string' && drop.cardId.length > 0;
  const hasCurrency = Number.isFinite(drop.currency) && drop.currency > 0;
  if (!hasCard && !hasCurrency) {
    return null;
  }

  const normalized = {
    name: variant.name.trim(),
    drop: hasCard ? { cardId: drop.cardId } : { currency: drop.currency },
  };

  if (Number.isFinite(variant.hpMult) && variant.hpMult > 0) {
    normalized.hpMult = variant.hpMult;
  }
  if (Number.isFinite(variant.damageMult) && variant.damageMult > 0) {
    normalized.damageMult = variant.damageMult;
  }
  if (typeof variant.tint === 'string' && variant.tint) {
    normalized.tint = variant.tint;
  }
  if (Number.isFinite(variant.scaleMult) && variant.scaleMult > 0) {
    normalized.scaleMult = variant.scaleMult;
  }

  return normalized;
}

function ensureNamedRareDropsClaimed(run) {
  if (!run) return null;
  if (!Array.isArray(run.namedRareDropsClaimed)) {
    run.namedRareDropsClaimed = [];
  }
  return run.namedRareDropsClaimed;
}

function isNamedRareDropClaimed(run, namedRareId) {
  const claimed = ensureNamedRareDropsClaimed(run);
  return !!claimed && claimed.includes(namedRareId);
}

function claimNamedRareDrop(run, namedRareId) {
  const claimed = ensureNamedRareDropsClaimed(run);
  if (!claimed || claimed.includes(namedRareId)) {
    return false;
  }
  claimed.push(namedRareId);
  return true;
}

/**
 * Apply a scripted named-rare variant to a freshly spawned enemy.
 * Skips affix rolling by forcing `enemy.variant = null`.
 *
 * @param {object} enemy
 * @param {NamedRareVariantConfig} variantConfig
 * @param {object} [_questContext]
 * @returns {object}
 */
function applyNamedRareVariant(enemy, variantConfig, _questContext = {}) {
  if (!enemy || !variantConfig) {
    return enemy;
  }

  const namedRare = {
    id: slugFromName(variantConfig.name),
    name: variantConfig.name,
    drop: { ...variantConfig.drop },
  };
  if (variantConfig.tint) {
    namedRare.tint = variantConfig.tint;
  }
  if (variantConfig.scaleMult) {
    namedRare.scaleMult = variantConfig.scaleMult;
  }

  enemy.namedRare = namedRare;
  enemy.variant = null;

  const hpMult = variantConfig.hpMult ?? 1;
  if (hpMult !== 1) {
    enemy.hp = Math.round(enemy.hp * hpMult);
    enemy.maxHp = Math.round(enemy.maxHp * hpMult);
  }

  const damageMult = variantConfig.damageMult ?? 1;
  if (damageMult !== 1 && Number.isFinite(enemy.attackDamage)) {
    enemy.attackDamage = Math.round(enemy.attackDamage * damageMult);
  }

  return enemy;
}

/**
 * Resolve the named-rare unique drop for an enemy if it has not been claimed this run.
 * @returns {{ cardId?: string, currency?: number } | null}
 */
function resolveNamedRareDrop(enemy, run) {
  if (!enemy?.namedRare?.id || !enemy.namedRare.drop) {
    return null;
  }
  if (isNamedRareDropClaimed(run, enemy.namedRare.id)) {
    return null;
  }
  return { ...enemy.namedRare.drop };
}

module.exports = {
  slugFromName,
  normalizeNamedRareVariant,
  applyNamedRareVariant,
  ensureNamedRareDropsClaimed,
  isNamedRareDropClaimed,
  claimNamedRareDrop,
  resolveNamedRareDrop,
};
