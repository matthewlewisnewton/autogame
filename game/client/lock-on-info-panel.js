/** Human-readable labels for enemy surfaced stat keys. */
export const STAT_LABELS = {
  hp: 'HP',
  attackDamage: 'Attack',
  attackStyle: 'Attack style',
  chaseSpeed: 'Chase speed',
  attackRange: 'Range',
  spawnIntervalMs: 'Spawn interval',
  spawnType: 'Spawn type',
  bonusDrop: 'Bonus drop',
  radius: 'Explosion radius',
  damage: 'Explosion damage',
  shieldHp: 'Shield',
  maxShieldHp: 'Max shield',
  leechFraction: 'Leech',
  chaseSpeedMult: 'Chase speed (enraged)',
  attackWindupMult: 'Attack speed (enraged)',
};

function statLabelFor(key) {
  return STAT_LABELS[key] || key;
}

function resolveRawStatValue(enemy, key, catalog) {
  if (!enemy || !catalog) return undefined;
  if (enemy[key] !== undefined && enemy[key] !== null) {
    return enemy[key];
  }
  const typeEntry = catalog.types?.[enemy.type];
  if (typeEntry && typeEntry[key] !== undefined) {
    return typeEntry[key];
  }
  if (enemy.variant) {
    const variantEntry = catalog.variants?.[enemy.variant];
    if (variantEntry && variantEntry[key] !== undefined) {
      return variantEntry[key];
    }
  }
  return undefined;
}

function formatAttackStyle(value) {
  if (typeof value !== 'string') return String(value);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatBonusDrop(value) {
  if (!value || typeof value !== 'object') return String(value ?? '');
  const parts = [];
  if (value.card) parts.push('Extra card');
  if (value.magicStone != null) parts.push(`${value.magicStone} magic stones`);
  return parts.length > 0 ? parts.join(', ') : JSON.stringify(value);
}

function formatSpawnType(value, catalog) {
  if (typeof value !== 'string') return String(value ?? '');
  return catalog?.types?.[value]?.name || value;
}

/**
 * Format a single surfaced stat for the lock-on panel.
 * Uses live enemy values when present, otherwise catalog type/variant defaults.
 */
export function formatStatValue(enemy, key, catalog) {
  const raw = resolveRawStatValue(enemy, key, catalog);
  if (raw === undefined || raw === null) return '';

  switch (key) {
    case 'attackStyle':
      return formatAttackStyle(raw);
    case 'spawnType':
      return formatSpawnType(raw, catalog);
    case 'spawnIntervalMs':
      return `${raw / 1000}s`;
    case 'leechFraction':
      return `${Math.round(Number(raw) * 100)}%`;
    case 'chaseSpeedMult':
    case 'attackWindupMult':
      return `×${raw}`;
    case 'bonusDrop':
      return formatBonusDrop(raw);
    default:
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Number.isInteger(raw) ? String(raw) : String(Math.round(raw * 10) / 10);
      }
      return String(raw);
  }
}

/**
 * Build the lock-on info panel view-model from a live enemy and server catalog.
 * Returns null when the enemy is missing or dead.
 */
export function buildLockOnPanelModel(enemy, catalog) {
  if (!enemy || enemy.hp <= 0 || !catalog) return null;

  const typeEntry = catalog.types?.[enemy.type];
  if (!typeEntry) return null;

  const hp = enemy.hp ?? 0;
  const maxHp = enemy.maxHp ?? hp;
  const hpText = `${hp} / ${maxHp}`;

  const stats = [];
  const seenLabels = new Set();

  const addStat = (key) => {
    if (key === 'hp') return;
    const label = statLabelFor(key);
    if (seenLabels.has(label)) return;
    const value = formatStatValue(enemy, key, catalog);
    if (!value) return;
    seenLabels.add(label);
    stats.push({ label, value });
  };

  for (const key of typeEntry.surfacedStats || []) {
    addStat(key);
  }

  let variantName;
  if (enemy.variant) {
    const variantEntry = catalog.variants?.[enemy.variant];
    if (variantEntry) {
      variantName = variantEntry.name;
      for (const key of variantEntry.surfacedStats || []) {
        addStat(key);
      }
    }
  }

  let description = typeEntry.description || '';
  if (enemy.variant) {
    const variantDesc = catalog.variants?.[enemy.variant]?.description;
    if (variantDesc) {
      description = description ? `${description} ${variantDesc}` : variantDesc;
    }
  }

  return {
    name: typeEntry.name,
    variantName,
    description,
    hpText,
    stats,
  };
}
