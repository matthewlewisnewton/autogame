// ── Card Level Upgrade Helpers ──
// Shared by Photon Forge UI and unit tests.

export const MAX_CARD_LEVEL = 10;
export const UPGRADE_COST_BASE = 100;

export function getUpgradeCost(level) {
  const currentLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return UPGRADE_COST_BASE * currentLevel;
}

export function getLevelStatMultiplier(level) {
  const lv = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return 1 + (lv - 1) * 0.1;
}

export function canAffordUpgrade(currency, level) {
  if (!Number.isFinite(level) || level >= MAX_CARD_LEVEL) return false;
  const cost = getUpgradeCost(level);
  return Number.isFinite(currency) && currency >= cost;
}

export function getForgeStatPreview(cardDef, level) {
  if (!cardDef) return [];

  const currentLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const nextLevel = Math.min(currentLevel + 1, MAX_CARD_LEVEL);
  const curMult = getLevelStatMultiplier(currentLevel);
  const nextMult = getLevelStatMultiplier(nextLevel);
  const rows = [
    { label: 'Level', current: String(currentLevel), next: String(nextLevel) },
  ];

  if (cardDef.damage != null) {
    rows.push({
      label: 'Damage',
      current: String(Math.round(cardDef.damage * curMult)),
      next: String(Math.round(cardDef.damage * nextMult)),
    });
  } else if (cardDef.type === 'weapon') {
    rows.push({
      label: 'Power',
      current: `${Math.round(curMult * 100)}%`,
      next: `${Math.round(nextMult * 100)}%`,
    });
  }

  if (cardDef.minionHp != null) {
    rows.push({
      label: 'Minion HP',
      current: String(Math.round(cardDef.minionHp * curMult)),
      next: String(Math.round(cardDef.minionHp * nextMult)),
    });
  }

  if (cardDef.charges != null) {
    rows.push({
      label: 'Charges',
      current: String(cardDef.charges),
      next: String(cardDef.charges),
    });
  }

  return rows;
}
