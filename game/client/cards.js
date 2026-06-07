// ── Card Data Module ──
// Shared card definitions, starting deck builder, and type styling.
// ES module — CARD_DEFS is rebuilt from the shared single sources that the
// server also consumes (server/progression.js): identity from
// ../shared/cardDefs.json and per-card stats from ../shared/cardStats.json.

import cardIdentity from '../shared/cardDefs.json' with { type: 'json' };
import cardStats from '../shared/cardStats.json' with { type: 'json' };
import cardEconomy from '../shared/cardEconomy.json' with { type: 'json' };

// ── Card Definitions ──
// Keyed by card id. Each entry is the identity subset
// { id, name, type, charges, acquisition, rewardOrder } from the shared
// cardIdentity, merged with the full per-card stat object from the shared
// cardStats. Both are the same sources the server uses, so the client no longer
// hand-maintains a partial stat copy and the two sides cannot drift.
//   type: "weapon" | "spell" | "creature" | "enchantment"
//   charges: uses remaining (multi-use weapons > 1, single-use = 1)
export const CARD_DEFS = Object.fromEntries(
  Object.keys(cardIdentity).map((id) => [
    id,
    { ...cardIdentity[id], ...cardStats[id] },
  ]),
);

export const EVOLUTION_GRIND_REQUIRED = 10;
export const GRIND_COST_BASE = 100;
export const GRIND_STAT_SCALE = 0.05;
/** Pre-0be7d29 evolved card ids mapped to their current names. */
export const LEGACY_EVOLVED_CARD_IDS = {
  steel_broadsword: 'steel_claymore',
  inferno_edge: 'magma_greatsword',
  guardian_familiar: 'astral_guardian',
  ancient_drake: 'ancient_wyrm',
};

export function migrateCardId(cardId) {
  if (!cardId || typeof cardId !== 'string') return cardId;
  return LEGACY_EVOLVED_CARD_IDS[cardId] || cardId;
}

// EVOLUTION_TRANSFORMS and CARD_SELL_VALUES come from the single shared source
// the server (server/progression.js) also consumes, so the two sides cannot drift.
export const EVOLUTION_TRANSFORMS = cardEconomy.evolutionTransforms;

export const CARD_SELL_VALUES = cardEconomy.cardSellValues;

export function getCardSellValue(cardId) {
  if (Object.prototype.hasOwnProperty.call(CARD_SELL_VALUES, cardId)) {
    return CARD_SELL_VALUES[cardId];
  }
  const def = CARD_DEFS[cardId];
  if (!def) return 0;
  if (def.isEvolved) return 15;
  if (def.type === 'spell') return 12;
  if (def.type === 'creature') return 10;
  return 5;
}

export function getGrindCost(grind) {
  const level = Number.isFinite(grind) ? Math.max(0, Math.floor(grind)) : 0;
  return GRIND_COST_BASE * (level + 1);
}

export function getStatMultiplier(grind) {
  const level = Number.isFinite(grind) ? Math.max(0, Math.floor(grind)) : 0;
  return 1.0 + (level * GRIND_STAT_SCALE);
}

export function scaledGrindStat(baseValue, grind) {
  if (!Number.isFinite(baseValue)) return baseValue;
  return Math.round(baseValue * getStatMultiplier(grind));
}

export function getForgeAttunePreview(cardDef, grind) {
  if (!cardDef) return [];

  const currentGrind = Number.isFinite(grind) ? Math.max(0, Math.floor(grind)) : 0;
  const atMaxGrind = currentGrind >= EVOLUTION_GRIND_REQUIRED;
  const nextGrind = atMaxGrind ? currentGrind : currentGrind + 1;
  const rows = [{
    label: 'Attune',
    current: `+${currentGrind}`,
    next: atMaxGrind ? `+${EVOLUTION_GRIND_REQUIRED}` : `+${nextGrind}`,
  }];

  if (cardDef.damage != null) {
    rows.push({
      label: 'Damage',
      current: String(scaledGrindStat(cardDef.damage, currentGrind)),
      next: String(scaledGrindStat(cardDef.damage, nextGrind)),
    });
  } else if (cardDef.type === 'weapon') {
    rows.push({
      label: 'Power',
      current: `${Math.round(getStatMultiplier(currentGrind) * 100)}%`,
      next: `${Math.round(getStatMultiplier(nextGrind) * 100)}%`,
    });
  }

  if (cardDef.minionHp != null) {
    rows.push({
      label: 'Minion HP',
      current: String(scaledGrindStat(cardDef.minionHp, currentGrind)),
      next: String(scaledGrindStat(cardDef.minionHp, nextGrind)),
    });
  }

  return rows;
}

// ── Starting Deck ──
// Returns an array of card id strings. First 4 become the initial hand;
// the rest are available for draws during play.
export function createStartingDeck() {
  return [
    'iron_sword',
    'flame_blade',
    'battle_familiar',
    'dungeon_drake',
    'iron_sword',
    'iron_sword',
    'iron_sword',
    'battle_familiar',
    'battle_familiar',
    'flame_blade',
    'flame_blade',
    'dungeon_drake',
  ];
}

// ── Type Styling ──
// Maps card type to a distinct CSS color and a short icon/label for UI rendering.
export const CARD_TYPE_STYLE = {
  weapon: { color: '#60a5fa', icon: '⚔' },
  spell: { color: '#f59e0b', icon: '✦' },
  creature: { color: '#a78bfa', icon: '🐉' },
  enchantment: { color: '#2dd4bf', icon: '✨' },
};

// Optional per-card accent overrides for the expanded pack.
export const CARD_ACCENT_STYLE = {
  steel_claymore: { color: '#94a3b8', icon: '🗡' },
  saber_of_light: { color: '#fef08a', icon: '☀' },
  excalibur_photon: { color: '#e879f9', icon: '⚡' },
  photon_slicer: { color: '#22d3ee', icon: '⟲' },
  infinite_disk: { color: '#a5f3fc', icon: '∞' },
  arcane_bolt: { color: '#a78bfa', icon: '⟡' },
  fireball: { color: '#f97316', icon: '🔥' },
  ice_ball: { color: '#67e8f9', icon: '❄' },
  chain_lightning: { color: '#38bdf8', icon: '⚡' },
  frost_nova: { color: '#67e8f9', icon: '❄' },
  permafrost_lance: { color: '#67e8f9', icon: '❄' },
  glacier_collapse: { color: '#38bdf8', icon: '🧊' },
  healing_font: { color: '#86efac', icon: '◈' },
  purifying_pulse: { color: '#a7f3d0', icon: '✦' },
  divine_grace: { color: '#fde68a', icon: '✧' },
  skeleton_knight: { color: '#d4d4d8', icon: '💀' },
  undead_commander: { color: '#a1a1aa', icon: '☠' },
  storm_eagle: { color: '#93c5fd', icon: '🦅' },
  thunderbird: { color: '#38bdf8', icon: '⚡' },
  gravity_well: { color: '#c084fc', icon: '◎' },
  event_horizon: { color: '#581c87', icon: '◉' },
  echo_blade: { color: '#f472b6', icon: '〰' },
  resonance_edge: { color: '#e879f9', icon: '≋' },
  mana_leach: { color: '#a855f7', icon: '◈' },
  soul_drain: { color: '#e879f9', icon: '☠' },
  dragons_breath: { color: '#fb923c', icon: '🔥' },
  magma_greatsword: { color: '#f97316', icon: '🗡' },
  inferno_pillar: { color: '#ef4444', icon: '🌋' },
  aegis_sentinel: { color: '#4ade80', icon: '🛡' },
  astral_guardian: { color: '#818cf8', icon: '✧' },
  ancient_wyrm: { color: '#9333ea', icon: '🔥' },
  null_crawler: { color: '#22d3ee', icon: '◎' },
  bulkhead_mauler: { color: '#78716c', icon: '⬡' },
  rusty_shiv: { color: '#78716c', icon: '🗡' },
  desperate_lunge: { color: '#b91c1c', icon: '⚡' },
  throw_rock: { color: '#78716c', icon: '🪨' },
  memory_shard: { color: '#c084fc', icon: '◇' },
  telepipe: { color: '#67e8f9', icon: '⬡' },
  spike_trap: { color: '#f87171', icon: '⚠' },
  mirror_ward: { color: '#5eead4', icon: '🪞' },
  cinder_snare: { color: '#f97316', icon: '🔥' },
};

// Per-player desperation cards (not deck-buildable).
export const DESPERATION_CARD_DEFS = {
  rusty_shiv: {
    id: 'rusty_shiv',
    name: 'Emergency Shiv',
    type: 'weapon',
    charges: 1,
  },
  desperate_lunge: {
    id: 'desperate_lunge',
    name: 'Last Gasp',
    type: 'weapon',
    charges: 1,
  },
  throw_rock: {
    id: 'throw_rock',
    name: 'Debris Toss',
    type: 'weapon',
    charges: 1,
  },
  memory_shard: {
    id: 'memory_shard',
    name: 'Echo Shard',
    type: 'spell',
    charges: 1,
    magicStoneCost: 0,
    effect: 'memory_shard',
  },
};

export const DESPERATION_DECK_TEMPLATE = [
  'rusty_shiv',
  'throw_rock',
  'throw_rock',
  'throw_rock',
  'desperate_lunge',
  'desperate_lunge',
  'memory_shard',
];

export function getCardDef(cardId) {
  return CARD_DEFS[cardId] || DESPERATION_CARD_DEFS[cardId] || null;
}

export function buildDesperationHandCard(cardId) {
  const def = DESPERATION_CARD_DEFS[cardId];
  if (!def) return null;
  const card = {
    id: def.id,
    name: def.name,
    type: def.type,
    charges: def.charges,
    remainingCharges: def.charges,
    isDesperation: true,
  };
  if (def.magicStoneCost != null) {
    card.magicStoneCost = def.magicStoneCost;
  }
  if (def.effect) {
    card.effect = def.effect;
  }
  return card;
}

// ── Card ID Sets by Type ──
// Pre-computed Sets for O(1) membership checks in hot paths (e.g. cardUsed handler).
export const weaponCardIds = new Set();
export const spellCardIds = new Set();
export const creatureCardIds = new Set();
export const enchantmentCardIds = new Set();
for (const def of Object.values(CARD_DEFS)) {
  if (def.type === 'weapon') weaponCardIds.add(def.id);
  if (def.type === 'spell') spellCardIds.add(def.id);
  if (def.type === 'creature') creatureCardIds.add(def.id);
  if (def.type === 'enchantment') enchantmentCardIds.add(def.id);
}
for (const def of Object.values(DESPERATION_CARD_DEFS)) {
  if (def.type === 'weapon') weaponCardIds.add(def.id);
  if (def.type === 'spell') spellCardIds.add(def.id);
}
