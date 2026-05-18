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
};

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
for (const def of Object.values(CARD_DEFS)) {
  if (def.type === 'weapon') weaponCardIds.add(def.id);
  if (def.type === 'summon') summonCardIds.add(def.id);
}
