// ── Card Data Module ──
// Shared card definitions, starting deck builder, and type styling.
// ES module — no imports from the rest of the app.

// ── Card Definitions ──
// Keyed by card id. Each entry: { id, name, type, charges }
//   type: "weapon" | "summon" | "monster"
//   charges: uses remaining (multi-use weapons > 1, single-use = 1)
export const CARD_DEFS = {
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    type: 'weapon',
    charges: 5,
  },
  flame_blade: {
    id: 'flame_blade',
    name: 'Flame Blade',
    type: 'weapon',
    charges: 3,
  },
  battle_familiar: {
    id: 'battle_familiar',
    name: 'Battle Familiar',
    type: 'summon',
    charges: 1,
    magicStoneCost: 50,
    damage: 40,
  },
  dungeon_drake: {
    id: 'dungeon_drake',
    name: 'Dungeon Drake',
    type: 'monster',
    charges: 1,
  },
  steel_broadsword: {
    id: 'steel_broadsword',
    name: 'Steel Broadsword',
    type: 'weapon',
    charges: 6,
    isEvolved: true,
    specialEffect: 'knockback',
  },
  inferno_edge: {
    id: 'inferno_edge',
    name: 'Inferno Edge',
    type: 'weapon',
    charges: 4,
    isEvolved: true,
    specialEffect: 'fire_trail',
  },
  guardian_familiar: {
    id: 'guardian_familiar',
    name: 'Guardian Familiar',
    type: 'summon',
    charges: 1,
    magicStoneCost: 65,
    damage: 70,
    isEvolved: true,
    specialEffect: 'barrier_burst',
  },
  ancient_drake: {
    id: 'ancient_drake',
    name: 'Ancient Drake',
    type: 'monster',
    charges: 1,
    isEvolved: true,
    specialEffect: 'bleed',
  },
  mana_prism: {
    id: 'mana_prism',
    name: 'Mana Prism',
    type: 'summon',
    charges: 1,
    magicStoneCost: 0,
    effect: 'mana_prism',
  },
  harvesting_scythe: {
    id: 'harvesting_scythe',
    name: 'Harvesting Scythe',
    type: 'weapon',
    charges: 3,
  },
  sacrificial_altar: {
    id: 'sacrificial_altar',
    name: 'Sacrificial Altar',
    type: 'summon',
    charges: 1,
    magicStoneCost: 0,
    effect: 'sacrificial_altar',
  },
  battery_automaton: {
    id: 'battery_automaton',
    name: 'Battery Automaton',
    type: 'monster',
    charges: 1,
    magicStoneCost: 50,
    effect: 'battery_automaton',
  },
  chrono_trigger: {
    id: 'chrono_trigger',
    name: 'Chrono Trigger',
    type: 'summon',
    charges: 1,
    magicStoneCost: 0,
    effect: 'chrono_trigger',
    adjacentChargeRestore: 2,
  },
};

export const EVOLUTION_GRIND_REQUIRED = 10;
export const EVOLUTION_TRANSFORMS = {
  iron_sword: 'steel_broadsword',
  flame_blade: 'inferno_edge',
  battle_familiar: 'guardian_familiar',
  dungeon_drake: 'ancient_drake',
};

export const CARD_SELL_VALUES = {
  iron_sword: 5,
  flame_blade: 8,
  battle_familiar: 12,
  dungeon_drake: 10,
  steel_broadsword: 15,
  inferno_edge: 18,
  guardian_familiar: 25,
  ancient_drake: 20,
  mana_prism: 10,
  harvesting_scythe: 6,
  sacrificial_altar: 14,
  battery_automaton: 12,
  chrono_trigger: 16,
};

export function getCardSellValue(cardId) {
  if (Object.prototype.hasOwnProperty.call(CARD_SELL_VALUES, cardId)) {
    return CARD_SELL_VALUES[cardId];
  }
  const def = CARD_DEFS[cardId];
  if (!def) return 0;
  if (def.isEvolved) return 15;
  if (def.type === 'summon') return 12;
  if (def.type === 'monster') return 10;
  return 5;
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
    'battle_familiar',
    'flame_blade',
  ];
}

// ── Type Styling ──
// Maps card type to a distinct CSS color and a short icon/label for UI rendering.
export const CARD_TYPE_STYLE = {
  weapon: { color: '#60a5fa', icon: '⚔' },
  summon: { color: '#f59e0b', icon: '✦' },
  monster: { color: '#a78bfa', icon: '🐉' },
};

// ── Card ID Sets by Type ──
// Pre-computed Sets for O(1) membership checks in hot paths (e.g. cardUsed handler).
export const weaponCardIds = new Set();
export const summonCardIds = new Set();
export const monsterCardIds = new Set();
for (const def of Object.values(CARD_DEFS)) {
  if (def.type === 'weapon') weaponCardIds.add(def.id);
  if (def.type === 'summon') summonCardIds.add(def.id);
  if (def.type === 'monster') monsterCardIds.add(def.id);
}
