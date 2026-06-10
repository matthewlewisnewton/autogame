// Pure model builder + DOM sync for the stage-boss encounter HUD.
// Mirrors the build*Model / sync* shape of lock-on-info-panel.js so it can be
// unit-tested under jsdom without the live render loop.

import { getHpBarTier } from './vanguard-hud.js';

/** Generic label used when the catalog lacks the boss's display entry. */
const GENERIC_BOSS_NAME = 'Boss';

/** Per-quest stage-boss display names (title case for the encounter HUD). */
const QUEST_STAGE_BOSS_NAMES = {
  canyon_descent: 'Canyon Warden',
  frost_crossing: 'Permafrost Warden',
  spire_ascent: 'Summit Warden',
  training_caverns: 'Annex Overseer',
  arena_trials: 'Trial Warden',
};

/**
 * Build the boss-encounter HUD view-model from the live encounter, the enemy
 * list, and the server display catalog. Returns null when the encounter is not
 * being fought (dormant/unlocked, missing boss, or the boss is already dead).
 *
 * @param {{
 *   encounter?: { phase?: string, locked?: boolean, bossEnemyId?: string|null }|null,
 *   enemies?: Array<{ id?: string, type?: string, variant?: string, hp?: number, maxHp?: number }>,
 *   catalog?: { types?: object, variants?: object },
 *   questId?: string|null,
 * }} args
 */
export function buildBossEncounterModel({ encounter, enemies, catalog, questId = null } = {}) {
  if (!encounter) return null;
  if (encounter.phase !== 'active' && encounter.locked !== true) return null;

  const list = Array.isArray(enemies) ? enemies : [];
  const boss = list.find((e) => e && e.id === encounter.bossEnemyId);
  if (!boss) return null;

  const hp = boss.hp ?? 0;
  if (hp <= 0) return null;

  const maxHp = boss.maxHp ?? hp;
  const hpPct = maxHp > 0
    ? Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)))
    : 0;

  return {
    name: resolveBossName(boss, catalog, questId),
    hp,
    maxHp,
    hpPct,
    tier: getHpBarTier(hpPct),
  };
}

/** Resolve a boss's display name from the catalog, with a generic fallback. */
function resolveBossName(enemy, catalog, questId = null) {
  if (typeof enemy.displayName === 'string' && enemy.displayName.trim()) {
    return enemy.displayName.trim();
  }
  if (enemy.variant) {
    const variantEntry = catalog?.variants?.[enemy.variant];
    if (variantEntry?.name) return variantEntry.name;
  }
  if (questId && QUEST_STAGE_BOSS_NAMES[questId]) {
    return QUEST_STAGE_BOSS_NAMES[questId];
  }
  const typeEntry = catalog?.types?.[enemy.type];
  if (typeEntry?.name) return typeEntry.name;
  return GENERIC_BOSS_NAME;
}

/**
 * Apply a boss-encounter view-model to the HUD DOM and toggle visibility.
 * Shows the container and updates the boss name, HP-fill width (% of max), and
 * tier class when `model` is truthy; hides the container when `model` is null.
 *
 * @param {object|null} model - result of buildBossEncounterModel
 * @param {{ container?: Element, nameEl?: Element, fillEl?: Element }} els
 */
export function syncBossEncounterHud(model, els) {
  if (!els) return;
  const { container, nameEl, fillEl } = els;
  if (!container) return;

  if (!model) {
    container.classList.add('hidden');
    container.setAttribute('aria-hidden', 'true');
    return;
  }

  container.classList.remove('hidden');
  container.setAttribute('aria-hidden', 'false');

  if (nameEl) nameEl.textContent = model.name;

  if (fillEl) {
    fillEl.style.width = `${model.hpPct}%`;
    fillEl.classList.remove('hp-high', 'hp-mid', 'hp-low');
    fillEl.classList.add(model.tier);
  }
}
