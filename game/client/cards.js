// ── Card Data Module ──
// Shared card definitions, starting deck builder, and type styling.
// ES module — identity subset (id/name/type/charges) comes from the shared
// ../shared/cardDefs.json (single source of truth, mirrored on the server).

import cardIdentity from '../shared/cardDefs.json' with { type: 'json' };

// ── Card Definitions ──
// Keyed by card id. Identity fields { id, name, type, charges } are spread from
// the shared cardIdentity; each entry merges in client-only rendering hints.
//   type: "weapon" | "summon" | "monster"
//   charges: uses remaining (multi-use weapons > 1, single-use = 1)
export const CARD_DEFS = {
  iron_sword: {
    ...cardIdentity.iron_sword,
  },
  flame_blade: {
    ...cardIdentity.flame_blade,
  },
  battle_familiar: {
    ...cardIdentity.battle_familiar,
    magicStoneCost: 50,
    damage: 44,
  },
  dungeon_drake: {
    ...cardIdentity.dungeon_drake,
  },
  null_crawler: {
    ...cardIdentity.null_crawler,
    magicStoneCost: 35,
    specialEffect: 'phase_beam',
    effect: 'null_crawler',
  },
  bulkhead_mauler: {
    ...cardIdentity.bulkhead_mauler,
    specialEffect: 'shockwave_sweep',
    effect: 'bulkhead_mauler',
  },
  steel_claymore: {
    ...cardIdentity.steel_claymore,
    attackRange: 7,
    isEvolved: true,
    specialEffect: 'knockback',
  },
  magma_greatsword: {
    ...cardIdentity.magma_greatsword,
    isEvolved: true,
    specialEffect: 'fire_trail',
  },
  aegis_sentinel: {
    ...cardIdentity.aegis_sentinel,
    magicStoneCost: 45,
    damage: 0,
    isEvolved: true,
    specialEffect: 'astral_shield',
    effect: 'astral_guardian',
    taunt: true,
  },
  astral_guardian: {
    ...cardIdentity.astral_guardian,
    magicStoneCost: 65,
    damage: 66,
    isEvolved: true,
    specialEffect: 'astral_shield',
    effect: 'astral_guardian',
  },
  ancient_wyrm: {
    ...cardIdentity.ancient_wyrm,
    minionHp: 90,
    isEvolved: true,
    specialEffect: 'fire_breath',
    effect: 'ancient_wyrm',
  },
  mana_prism: {
    ...cardIdentity.mana_prism,
    magicStoneCost: 0,
    effect: 'mana_prism',
  },
  harvesting_scythe: {
    ...cardIdentity.harvesting_scythe,
  },
  deck_sifter: {
    ...cardIdentity.deck_sifter,
    effect: 'draw_card',
    magicStoneCost: 0,
  },
  sacrificial_altar: {
    ...cardIdentity.sacrificial_altar,
    magicStoneCost: 0,
    effect: 'sacrificial_altar',
  },
  battery_automaton: {
    ...cardIdentity.battery_automaton,
    magicStoneCost: 50,
    effect: 'battery_automaton',
  },
  chrono_trigger: {
    ...cardIdentity.chrono_trigger,
    magicStoneCost: 0,
    effect: 'chrono_trigger',
    adjacentChargeRestore: 2,
  },
  saber_of_light: {
    ...cardIdentity.saber_of_light,
    specialEffect: 'swift_slash',
  },
  excalibur_photon: {
    ...cardIdentity.excalibur_photon,
    isEvolved: true,
    specialEffect: 'photon_barrage',
  },
  photon_slicer: {
    ...cardIdentity.photon_slicer,
    specialEffect: 'returning_projectile',
  },
  infinite_disk: {
    ...cardIdentity.infinite_disk,
    isEvolved: true,
    specialEffect: 'triple_returning_projectile',
  },
  arcane_bolt: {
    ...cardIdentity.arcane_bolt,
    attackRange: 10,
    specialEffect: 'long_range',
  },
  frost_nova: {
    ...cardIdentity.frost_nova,
    magicStoneCost: 35,
    effect: 'frost_nova',
    specialEffect: 'freeze',
  },
  glacier_collapse: {
    ...cardIdentity.glacier_collapse,
    magicStoneCost: 35,
    effect: 'glacier_collapse',
    isEvolved: true,
    specialEffect: 'shatter',
  },
  healing_font: {
    ...cardIdentity.healing_font,
    magicStoneCost: 0,
    effect: 'healing_font',
    specialEffect: 'heal',
  },
  divine_grace: {
    ...cardIdentity.divine_grace,
    magicStoneCost: 0,
    effect: 'divine_grace',
    healAmount: 38,
    magicStoneRestore: 10,
    isEvolved: true,
    specialEffect: 'heal_and_mana',
  },
  skeleton_knight: {
    ...cardIdentity.skeleton_knight,
    specialEffect: 'taunt',
  },
  undead_commander: {
    ...cardIdentity.undead_commander,
    isEvolved: true,
    specialEffect: 'summon_skeletons',
  },
  storm_eagle: {
    ...cardIdentity.storm_eagle,
    magicStoneCost: 40,
    specialEffect: 'ranged_strike',
  },
  thunderbird: {
    ...cardIdentity.thunderbird,
    magicStoneCost: 40,
    isEvolved: true,
    specialEffect: 'chain_lightning',
  },
  gravity_well: {
    ...cardIdentity.gravity_well,
    magicStoneCost: 45,
    effect: 'gravity_well',
    specialEffect: 'pull',
  },
  event_horizon: {
    ...cardIdentity.event_horizon,
    magicStoneCost: 45,
    effect: 'event_horizon',
    isEvolved: true,
    specialEffect: 'crush',
  },
  echo_blade: {
    ...cardIdentity.echo_blade,
    specialEffect: 'shockwave',
  },
  resonance_edge: {
    ...cardIdentity.resonance_edge,
    isEvolved: true,
    specialEffect: 'shockwave',
  },
  mana_leach: {
    ...cardIdentity.mana_leach,
    magicStoneCost: 30,
    specialEffect: 'mana_drain',
  },
  soul_drain: {
    ...cardIdentity.soul_drain,
    magicStoneCost: 30,
    isEvolved: true,
    specialEffect: 'soul_drain',
  },
  dragons_breath: {
    ...cardIdentity.dragons_breath,
    magicStoneCost: 40,
    effect: 'dragons_breath',
    specialEffect: 'fire_dot',
  },
  inferno_pillar: {
    ...cardIdentity.inferno_pillar,
    magicStoneCost: 40,
    effect: 'inferno_pillar',
    isEvolved: true,
    specialEffect: 'fire_dot',
  },
  telepipe: {
    ...cardIdentity.telepipe,
    magicStoneCost: 0,
    effect: 'telepipe',
    specialEffect: 'portal',
  },
  spike_trap: {
    ...cardIdentity.spike_trap,
    magicStoneCost: 25,
    effect: 'spike_trap',
    target: 'ground',
    specialEffect: 'proximity_hazard',
  },
  mirror_ward: {
    ...cardIdentity.mirror_ward,
    magicStoneCost: 30,
    effect: 'mirror_ward',
    target: 'self',
    specialEffect: 'damage_reflect',
  },
};

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

export const EVOLUTION_TRANSFORMS = {
  iron_sword: 'steel_claymore',
  flame_blade: 'magma_greatsword',
  battle_familiar: 'astral_guardian',
  dungeon_drake: 'ancient_wyrm',
  saber_of_light: 'excalibur_photon',
  photon_slicer: 'infinite_disk',
  frost_nova: 'glacier_collapse',
  healing_font: 'divine_grace',
  skeleton_knight: 'undead_commander',
  storm_eagle: 'thunderbird',
  gravity_well: 'event_horizon',
  echo_blade: 'resonance_edge',
  mana_leach: 'soul_drain',
  dragons_breath: 'inferno_pillar',
};

export const CARD_SELL_VALUES = {
  iron_sword: 5,
  flame_blade: 8,
  battle_familiar: 12,
  dungeon_drake: 10,
  null_crawler: 12,
  bulkhead_mauler: 10,
  steel_claymore: 15,
  magma_greatsword: 18,
  astral_guardian: 25,
  ancient_wyrm: 20,
  divine_grace: 18,
  undead_commander: 18,
  thunderbird: 18,
  mana_prism: 10,
  harvesting_scythe: 6,
  sacrificial_altar: 14,
  battery_automaton: 12,
  chrono_trigger: 16,
  saber_of_light: 8,
  excalibur_photon: 12,
  infinite_disk: 18,
  arcane_bolt: 8,
  event_horizon: 22,
  soul_drain: 18,
  dragons_breath: 14,
  inferno_pillar: 22,
  telepipe: 18,
};

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
  frost_nova: { color: '#67e8f9', icon: '❄' },
  glacier_collapse: { color: '#38bdf8', icon: '🧊' },
  healing_font: { color: '#86efac', icon: '♥' },
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
