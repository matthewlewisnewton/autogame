// ── Server Progression Module ──
// Player persistence, rewards, deck/hand management, run state, spawning, snapshots.
// Imported by index.js; re-exported from index.js for test compatibility.

const crypto = require('crypto');
const {
  DECK_MIN_SIZE,
  DECK_MAX_SIZE,
  MAX_HP,
  MAX_MAGIC_STONES,
  SPAWN_PADDING,
  LOOT_SPAWN_CHANCE,
  VICTORY_REWARD_ROTATION,
  ENEMY_CARD_DROPS,
  ENEMY_MS_DROPS,
  MAX_CARD_CHOICES,
  SHOP_CARD_POOL,
  SHOP_PRICE_MULTIPLIER,
  TICK_RATE,
  PORTAL_RADIUS,
  PORTAL_ENTER_COOLDOWN_MS,
  PORTAL_PLACEMENT_GRACE_MS
} = require('./config');
const {
  mulberry32,
  roomsByRole,
  randomRoomPositionByRole
} = require('./dungeon');
const {
  ENEMY_DEFS,
  firstRoomPosition,
  randomRoomPosition,
  randomWanderTarget
} = require('./simulation');
const { getQuest, getSelectedQuest } = require('./quests');
const { THEME } = require('./theme');

let _gameState = null;
let _getIo = () => null;
let _broadcastLobbyUpdate = () => {};
let _rebuildWallColliders = () => {};
let provider = null;

function initProgression(deps) {
  _gameState = deps.gameState;
  if (deps.getIo) _getIo = deps.getIo;
  else if (deps.io) _getIo = () => deps.io;
}

function getGameState() {
  return _gameState;
}

function setGameState(gs) {
  _gameState = gs;
}

function getIoTarget() {
  const io = _getIo();
  if (!io) return null;
  const { getLobbyById, _lobbies } = require('./lobbies');
  if (_gameState && _gameState._lobbyId && typeof io.to === 'function') {
    if (getLobbyById(_gameState._lobbyId)) {
      return io.to(_gameState._lobbyId);
    }
  }
  if (_gameState && _lobbies) {
    for (const lobby of _lobbies.values()) {
      if (lobby.state === _gameState) {
        return io.to(lobby.id);
      }
    }
  }
  return io;
}

function setBroadcastLobbyUpdate(fn) {
  _broadcastLobbyUpdate = fn;
}

function setRebuildWallColliders(fn) {
  _rebuildWallColliders = fn;
}

function setTestProvider(p) {
  provider = p;
}

function getProvider() {
  return provider;
}

// Server-side card definitions (mirrors game/client/cards.js, weapon entries include damage)
const CARD_DEFS = {
  iron_sword: { id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', damage: 15, charges: 5 },
  flame_blade: { id: 'flame_blade', name: 'Solar Edge', type: 'weapon', damage: 25, charges: 3 },
  battle_familiar: { id: 'battle_familiar', name: 'Signal Familiar', type: 'spell', charges: 1, magicStoneCost: 50, damage: 40 },
  dungeon_drake: { id: 'dungeon_drake', name: 'Vault Wyrm', type: 'creature', charges: 1 },
  steel_claymore: {
    id: 'steel_claymore',
    name: 'Alloy Greatblade',
    type: 'weapon',
    damage: 23,
    charges: 6,
    attackRange: 7,
    knockbackStrength: 3,
    isEvolved: true,
    specialEffect: 'knockback'
  },
  magma_greatsword: {
    id: 'magma_greatsword',
    name: 'Corebreaker Greatsword',
    type: 'weapon',
    damage: 38,
    charges: 4,
    dotTicks: 4,
    dotIntervalMs: 500,
    trailDamagePerTick: 10,
    isEvolved: true,
    specialEffect: 'fire_trail'
  },
  astral_guardian: {
    id: 'astral_guardian',
    name: 'Astral Guardian',
    type: 'spell',
    charges: 1,
    magicStoneCost: 65,
    damage: 60,
    isEvolved: true,
    specialEffect: 'astral_shield',
    effect: 'astral_guardian',
    shieldHp: 15,
    shieldDurationMs: 8000,
    minionHp: 60,
    minionTtl: 30,
    attackDamage: 10,
    // One attack per sim tick at most (TICK_RATE Hz); sub-tick intervals cannot fire faster.
    attackIntervalMs: Math.floor(1000 / TICK_RATE),
  },
  ancient_wyrm: {
    id: 'ancient_wyrm',
    name: 'Archive Wyrm',
    type: 'creature',
    charges: 1,
    minionHp: 90,
    isEvolved: true,
    specialEffect: 'fire_breath',
    effect: 'ancient_wyrm',
    breathIntervalMs: 3000,
    breathRange: 8,
    breathDamage: 15,
  },
  mana_prism: {
    id: 'mana_prism',
    name: 'Mana Prism',
    type: 'spell',
    charges: 1,
    magicStoneCost: 0,
    effect: 'mana_prism',
    durationSeconds: 12,
    magicStonePulse: 10,
    pulseIntervalMs: 2000,
  },
  harvesting_scythe: {
    id: 'harvesting_scythe',
    name: 'Ether Scythe',
    type: 'weapon',
    damage: 8,
    charges: 3,
    attackConeAngle: Math.PI,
    magicStoneOnHit: 5,
    magicStoneOnKill: 15,
  },
  sacrificial_altar: {
    id: 'sacrificial_altar',
    name: 'Offering Terminal',
    type: 'spell',
    charges: 1,
    magicStoneCost: 0,
    effect: 'sacrificial_altar',
    sacrificeRadius: 10,
    magicStoneGain: 100,
    chargeRestore: 2,
  },
  battery_automaton: {
    id: 'battery_automaton',
    name: 'Battery Automaton',
    type: 'creature',
    charges: 1,
    magicStoneCost: 50,
    effect: 'battery_automaton',
    minionHp: 80,
    minionTtl: 30,
    chargeRestore: 1,
    chargePulseIntervalMs: 6000,
  },
  chrono_trigger: {
    id: 'chrono_trigger',
    name: 'Chrono Trigger',
    type: 'spell',
    charges: 1,
    magicStoneCost: 0,
    effect: 'chrono_trigger',
    adjacentChargeRestore: 2,
  },
  saber_of_light: {
    id: 'saber_of_light',
    name: 'Saber of Light',
    type: 'weapon',
    damage: 8,
    charges: 6,
    cooldownMs: 400,
    specialEffect: 'swift_slash',
  },
  excalibur_photon: {
    id: 'excalibur_photon',
    name: 'Excalibur Photon',
    type: 'weapon',
    damage: 12,
    charges: 6,
    cooldownMs: 200,
    isEvolved: true,
    swingsPerUse: 2,
    specialEffect: 'photon_barrage',
  },
  photon_slicer: {
    id: 'photon_slicer',
    name: 'Photon Slicer',
    type: 'weapon',
    damage: 12,
    charges: 4,
    attackRange: 8,
    effect: 'returning_projectile',
    specialEffect: 'returning_projectile',
  },
  infinite_disk: {
    id: 'infinite_disk',
    name: 'Infinite Disk',
    type: 'weapon',
    damage: 18,
    charges: 4,
    attackRange: 8,
    effect: 'triple_returning_projectile',
    returnPasses: 3,
    isEvolved: true,
    specialEffect: 'triple_returning_projectile',
  },
  arcane_bolt: {
    id: 'arcane_bolt',
    name: 'Arcane Bolt',
    type: 'weapon',
    damage: 14,
    charges: 4,
    attackRange: 10,
    effect: 'projectile',
    specialEffect: 'long_range',
    projectile: { pierces: true },
  },
  frost_nova: {
    id: 'frost_nova',
    name: 'Cryo Burst',
    type: 'spell',
    charges: 1,
    magicStoneCost: 35,
    effect: 'frost_nova',
    damage: 10,
    freezeDurationMs: 2500,
    specialEffect: 'freeze',
  },
  glacier_collapse: {
    id: 'glacier_collapse',
    name: 'Glacier Rupture',
    type: 'spell',
    charges: 1,
    magicStoneCost: 35,
    effect: 'glacier_collapse',
    damage: 15,
    freezeDurationMs: 2500,
    frozenBonusDamage: 40,
    isEvolved: true,
    specialEffect: 'shatter',
  },
  healing_font: {
    id: 'healing_font',
    name: 'Restoration Beacon',
    type: 'spell',
    charges: 1,
    magicStoneCost: 0,
    effect: 'healing_font',
    healAmount: 25,
    specialEffect: 'heal',
  },
  divine_grace: {
    id: 'divine_grace',
    name: 'Sanctum Pulse',
    type: 'spell',
    charges: 1,
    magicStoneCost: 0,
    effect: 'divine_grace',
    healAmount: 38,
    magicStoneRestore: 10,
    isEvolved: true,
    specialEffect: 'heal_and_mana',
  },
  skeleton_knight: {
    id: 'skeleton_knight',
    name: 'Necroframe Knight',
    type: 'creature',
    charges: 1,
    minionHp: 120,
    effect: 'skeleton_knight',
    taunt: true,
    specialEffect: 'taunt',
  },
  undead_commander: {
    id: 'undead_commander',
    name: 'Legion Marshal',
    type: 'creature',
    charges: 1,
    minionHp: 180,
    effect: 'undead_commander',
    taunt: true,
    summonSkeletonCount: 2,
    summonSkeletonHp: 60,
    isEvolved: true,
    specialEffect: 'summon_skeletons',
  },
  storm_eagle: {
    id: 'storm_eagle',
    name: 'Stormwing Drone',
    type: 'creature',
    charges: 1,
    magicStoneCost: 40,
    effect: 'storm_eagle',
    minionHp: 45,
    attackRange: 7,
    attackDamage: 12,
    specialEffect: 'ranged_strike',
  },
  thunderbird: {
    id: 'thunderbird',
    name: 'Thunderbird',
    type: 'creature',
    charges: 1,
    magicStoneCost: 40,
    effect: 'thunderbird',
    minionHp: 68,
    attackRange: 11,
    attackDamage: 18,
    chainRadius: 5,
    maxChainTargets: 2,
    isEvolved: true,
    specialEffect: 'chain_lightning',
  },
  gravity_well: {
    id: 'gravity_well',
    name: 'Gravity Well',
    type: 'spell',
    charges: 1,
    magicStoneCost: 45,
    effect: 'gravity_well',
    pullRadius: 12,
    pullStrength: 4,
    specialEffect: 'pull',
  },
  event_horizon: {
    id: 'event_horizon',
    name: 'Event Horizon',
    type: 'spell',
    charges: 1,
    magicStoneCost: 45,
    effect: 'event_horizon',
    pullRadius: 12,
    pullStrength: 6,
    centerRadius: 2.5,
    centerDamage: 30,
    isEvolved: true,
    specialEffect: 'crush',
  },
  echo_blade: {
    id: 'echo_blade',
    name: 'Phase Echo',
    type: 'weapon',
    damage: 14,
    charges: 5,
    shockwaveEvery: 3,
    shockwaveDamage: 20,
    shockwaveRadius: 6,
    specialEffect: 'shockwave',
  },
  resonance_edge: {
    id: 'resonance_edge',
    name: 'Resonance Edge',
    type: 'weapon',
    damage: 21,
    charges: 5,
    shockwaveEvery: 2,
    shockwaveDamage: 30,
    shockwaveRadius: 6,
    isEvolved: true,
    specialEffect: 'shockwave',
  },
  mana_leach: {
    id: 'mana_leach',
    name: 'Ether Siphon',
    type: 'spell',
    charges: 1,
    magicStoneCost: 30,
    damage: 25,
    magicStoneOnHit: 8,
    specialEffect: 'mana_drain',
  },
  soul_drain: {
    id: 'soul_drain',
    name: 'Soul Drain',
    type: 'spell',
    charges: 1,
    magicStoneCost: 30,
    damage: 38,
    magicStoneOnHit: 12,
    healOnHit: 4,
    healOnKill: 8,
    isEvolved: true,
    specialEffect: 'soul_drain',
  },
  dragons_breath: {
    id: 'dragons_breath',
    name: 'Wyrmflare',
    type: 'spell',
    charges: 1,
    magicStoneCost: 40,
    effect: 'dragons_breath',
    damage: 8,
    dotTicks: 4,
    dotIntervalMs: 500,
    attackConeAngle: Math.PI / 3,
    attackRange: 7,
    specialEffect: 'fire_dot',
  },
  inferno_pillar: {
    id: 'inferno_pillar',
    name: 'Thermal Column',
    type: 'spell',
    charges: 1,
    magicStoneCost: 40,
    effect: 'inferno_pillar',
    damage: 12,
    dotTicks: 4,
    dotIntervalMs: 500,
    attackRange: 7,
    isEvolved: true,
    specialEffect: 'fire_dot',
  },
  telepipe: {
    id: 'telepipe',
    name: 'Telepipe',
    type: 'spell',
    charges: 1,
    magicStoneCost: 0,
    effect: 'telepipe',
    specialEffect: 'portal',
  },
  spike_trap: {
    id: 'spike_trap',
    name: 'Spike Trap',
    type: 'enchantment',
    charges: 1,
    magicStoneCost: 25,
    effect: 'spike_trap',
    target: 'ground',
    radius: 2.5,
    damage: 35,
    ttlMs: 30000,
    specialEffect: 'proximity_hazard',
  },
  mirror_ward: {
    id: 'mirror_ward',
    name: 'Mirror Ward',
    type: 'enchantment',
    charges: 1,
    magicStoneCost: 30,
    effect: 'mirror_ward',
    target: 'self',
    damageScale: 0.5,
    minReflectDamage: 15,
    reflectRange: 8,
    ttlMs: 20000,
    specialEffect: 'damage_reflect',
  },
};

// Starting deck card ids — mirrors createStartingDeck() in client/cards.js.
const STARTING_DECK_IDS = [
  'iron_sword',
  'flame_blade',
  'battle_familiar',
  'dungeon_drake',
  'iron_sword',
  'iron_sword',
  'battle_familiar',
  'flame_blade'
];

const EVOLUTION_GRIND_REQUIRED = 10;
const GRIND_COST_BASE = 100;
const GRIND_STAT_SCALE = 0.05;
const LEGACY_EVOLVED_CARD_IDS = {
  steel_broadsword: 'steel_claymore',
  inferno_edge: 'magma_greatsword',
  guardian_familiar: 'astral_guardian',
  ancient_drake: 'ancient_wyrm',
};

function migrateCardId(cardId) {
  if (!cardId || typeof cardId !== 'string') return cardId;
  return LEGACY_EVOLVED_CARD_IDS[cardId] || cardId;
}

const EVOLUTION_TRANSFORMS = {
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

const CARD_SELL_VALUES = {
  iron_sword: 5,
  flame_blade: 8,
  battle_familiar: 12,
  dungeon_drake: 10,
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
  event_horizon: 22,
  soul_drain: 18,
  dragons_breath: 14,
  inferno_pillar: 22,
  telepipe: 18,
};

function getCardSellValue(cardId) {
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

function getCardBuyValue(cardId) {
  return Math.max(1, getCardSellValue(cardId) * SHOP_PRICE_MULTIPLIER);
}

function pickShopOffer(seed) {
  const pool = SHOP_CARD_POOL.filter((id) => CARD_DEFS[id]);
  if (pool.length === 0) return null;
  const rng = mulberry32(seed);
  const cardId = pool[Math.floor(rng() * pool.length)];
  const def = CARD_DEFS[cardId];
  return {
    cardId,
    name: def.name,
    price: getCardBuyValue(cardId),
    type: def.type
  };
}

function isValidShopOffer(offer) {
  return !!(offer && typeof offer.cardId === 'string' && CARD_DEFS[offer.cardId]);
}

function refreshShopOffer() {
  if (!_gameState) return null;
  const seed = Math.floor(Math.random() * 2147483647);
  let offer = pickShopOffer(seed);
  if (!offer) {
    const fallbackId = SHOP_CARD_POOL.find((id) => CARD_DEFS[id]);
    if (!fallbackId) {
      _gameState.shopOffer = null;
      return null;
    }
    const def = CARD_DEFS[fallbackId];
    offer = {
      cardId: fallbackId,
      name: def.name,
      price: getCardBuyValue(fallbackId),
      type: def.type
    };
  }
  _gameState.shopOffer = offer;
  return _gameState.shopOffer;
}

function ensureShopOffer() {
  if (!_gameState) return null;
  if (!isValidShopOffer(_gameState.shopOffer)) {
    refreshShopOffer();
  }
  return _gameState.shopOffer;
}

function buyShopCard(player, shopOffer) {
  if (!shopOffer || !shopOffer.cardId) {
    return { ok: false, reason: 'no_offer' };
  }
  if (!CARD_DEFS[shopOffer.cardId]) {
    return { ok: false, reason: 'invalid_offer' };
  }
  const price = Number.isFinite(shopOffer.price)
    ? shopOffer.price
    : getCardBuyValue(shopOffer.cardId);
  if ((player.currency || 0) < price) {
    return { ok: false, reason: 'insufficient_gold' };
  }

  normalizePlayerInventory(player);
  if (!Array.isArray(player.selectedDeck)) {
    player.selectedDeck = [];
  }

  const instance = createCardInstance(shopOffer.cardId);
  if (!instance) {
    return { ok: false, reason: 'grant_failed' };
  }

  player.inventory.push(instance);
  player.ownedCards = inventoryToOwnedCards(player.inventory);

  let addedToDeck = false;
  if (canAddCardInstanceToDeck(instance.instanceId, player.selectedDeck, player.inventory)) {
    player.selectedDeck.push(instance.instanceId);
    addedToDeck = true;
  }

  player.currency -= price;

  const deckCheck = validateDeck(player.selectedDeck, player.inventory);
  if (!deckCheck.valid) {
    player.currency += price;
    if (addedToDeck) {
      player.selectedDeck = player.selectedDeck.filter((entry) => entry !== instance.instanceId);
    }
    player.inventory = player.inventory.filter((entry) => entry.instanceId !== instance.instanceId);
    player.ownedCards = inventoryToOwnedCards(player.inventory);
    return { ok: false, reason: deckCheck.reason };
  }

  return {
    ok: true,
    price,
    cardId: shopOffer.cardId,
    instanceId: instance.instanceId,
    addedToDeck,
    currency: player.currency
  };
}

const MAX_CARD_LEVEL = 10;
const UPGRADE_COST_BASE = 100;

function getUpgradeCost(level) {
  const currentLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return UPGRADE_COST_BASE * currentLevel;
}

function getLevelStatMultiplier(level) {
  const lv = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return 1 + (lv - 1) * 0.1;
}

function createCardInstance(cardId, overrides = {}) {
  if (!CARD_DEFS[cardId]) return null;
  const grind = Number.isFinite(overrides.grind) ? overrides.grind : 0;
  const level = Number.isFinite(overrides.level) ? overrides.level : 1;
  const instanceId = typeof overrides.instanceId === 'string' && overrides.instanceId.length > 0
    ? overrides.instanceId
    : crypto.randomUUID();
  return {
    ...overrides,
    instanceId,
    cardId,
    grind,
    level
  };
}

function createInventoryFromCardIds(cardIds) {
  return cardIds.map(cardId => createCardInstance(cardId)).filter(Boolean);
}

function createInventoryFromOwnedCards(ownedCards = {}) {
  const inventory = [];
  for (const [rawCardId, count] of Object.entries(ownedCards || {})) {
    const cardId = migrateCardId(rawCardId);
    if (!CARD_DEFS[cardId]) continue;
    const copies = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    for (let i = 0; i < copies; i++) {
      inventory.push(createCardInstance(cardId));
    }
  }
  return inventory;
}

function normalizeInventory(inventory, ownedCards) {
  if (!Array.isArray(inventory)) {
    return createInventoryFromOwnedCards(ownedCards);
  }

  const usedIds = new Set();
  const normalized = [];
  for (const entry of inventory) {
    const cardId = migrateCardId(entry?.cardId);
    if (!entry || typeof entry !== 'object' || !CARD_DEFS[cardId]) continue;
    let instance = createCardInstance(cardId, entry);
    if (!instance) continue;
    if (usedIds.has(instance.instanceId)) {
      instance = { ...instance, instanceId: crypto.randomUUID() };
    }
    usedIds.add(instance.instanceId);
    normalized.push(instance);
  }
  return normalized;
}

function inventoryToOwnedCards(inventory = []) {
  const ownedCards = {};
  for (const instance of Array.isArray(inventory) ? inventory : []) {
    if (!instance || !CARD_DEFS[instance.cardId]) continue;
    ownedCards[instance.cardId] = (ownedCards[instance.cardId] || 0) + 1;
  }
  return ownedCards;
}

function getInventoryInstance(inventory, instanceId) {
  if (!Array.isArray(inventory) || typeof instanceId !== 'string') return null;
  return inventory.find(instance => instance && instance.instanceId === instanceId) || null;
}

function cardIdForDeckEntry(entry, inventory) {
  const instance = getInventoryInstance(inventory, entry);
  if (instance) return instance.cardId;
  const cardId = migrateCardId(entry);
  return CARD_DEFS[cardId] ? cardId : null;
}

function normalizeSelectedDeck(selectedDeck, inventory) {
  if (!Array.isArray(selectedDeck)) return [];
  const usedInstanceIds = new Set();
  const normalized = [];

  for (const entry of selectedDeck) {
    if (typeof entry !== 'string') continue;

    const exactInstance = getInventoryInstance(inventory, entry);
    if (exactInstance) {
      if (!usedInstanceIds.has(exactInstance.instanceId)) {
        usedInstanceIds.add(exactInstance.instanceId);
        normalized.push(exactInstance.instanceId);
      }
      continue;
    }

    const migratedEntry = migrateCardId(entry);
    if (CARD_DEFS[migratedEntry]) {
      const available = inventory.find(instance =>
        instance.cardId === migratedEntry && !usedInstanceIds.has(instance.instanceId)
      );
      if (available) {
        usedInstanceIds.add(available.instanceId);
        normalized.push(available.instanceId);
      } else {
        normalized.push(entry);
      }
      continue;
    }

    normalized.push(entry);
  }

  return normalized;
}

function normalizePlayerInventory(player) {
  if (!player) return player;
  player.inventory = normalizeInventory(player.inventory, player.ownedCards);
  player.ownedCards = inventoryToOwnedCards(player.inventory);
  player.selectedDeck = normalizeSelectedDeck(player.selectedDeck || [], player.inventory);
  return player;
}

function findAvailableInventoryInstance(cardId, deck, inventory) {
  if (!CARD_DEFS[cardId] || !Array.isArray(inventory)) return null;
  const selected = new Set(Array.isArray(deck) ? deck : []);
  return inventory.find(instance => instance.cardId === cardId && !selected.has(instance.instanceId)) || null;
}

function canAddCardInstanceToDeck(instanceId, deck, inventory) {
  if (!Array.isArray(deck) || deck.length >= DECK_MAX_SIZE) return false;
  const instance = getInventoryInstance(inventory, instanceId);
  if (!instance) return false;
  return !deck.includes(instance.instanceId);
}

function getGrindCost(grind) {
  const level = Number.isFinite(grind) ? Math.max(0, Math.floor(grind)) : 0;
  return GRIND_COST_BASE * (level + 1);
}

function getStatMultiplier(grind) {
  const level = Number.isFinite(grind) ? Math.max(0, Math.floor(grind)) : 0;
  return 1.0 + (level * GRIND_STAT_SCALE);
}

function scaledGrindStat(baseValue, grind) {
  if (!Number.isFinite(baseValue)) return baseValue;
  return Math.round(baseValue * getStatMultiplier(grind));
}

function grindCard(player, instanceId) {
  if (!player) return { ok: false, reason: 'Player not found' };
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return { ok: false, reason: 'Missing instanceId' };
  }

  normalizePlayerInventory(player);

  const instance = getInventoryInstance(player.inventory, instanceId);
  if (!instance) {
    return { ok: false, reason: `Unknown card instance: ${instanceId}` };
  }

  const currentGrind = instance.grind || 0;
  if (currentGrind >= EVOLUTION_GRIND_REQUIRED) {
    return { ok: false, reason: `Card is already +${EVOLUTION_GRIND_REQUIRED}` };
  }

  const cost = getGrindCost(currentGrind);
  const currency = player.currency || 0;
  if (currency < cost) {
    return { ok: false, reason: `Not enough ${THEME.currency.short.toLowerCase()} (need ${cost}, have ${currency})` };
  }

  player.currency -= cost;
  instance.grind = currentGrind + 1;

  return {
    ok: true,
    instance: { ...instance },
    cost,
    currency: player.currency
  };
}

function evolveCard(player, instanceId) {
  if (!player) return { ok: false, reason: 'Player not found' };
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return { ok: false, reason: 'Missing instanceId' };
  }

  normalizePlayerInventory(player);

  const instance = getInventoryInstance(player.inventory, instanceId);
  if (!instance) {
    return { ok: false, reason: `Unknown card instance: ${instanceId}` };
  }

  if ((instance.grind || 0) < EVOLUTION_GRIND_REQUIRED) {
    return { ok: false, reason: `Card must be +${EVOLUTION_GRIND_REQUIRED} to evolve` };
  }

  const fromCardId = instance.cardId;
  const toCardId = EVOLUTION_TRANSFORMS[fromCardId];
  if (!toCardId || !CARD_DEFS[toCardId]) {
    return { ok: false, reason: `No evolution available for ${fromCardId}` };
  }

  instance.cardId = toCardId;
  instance.grind = 0;
  instance.evolvedFrom = fromCardId;
  instance.evolvedAt = Date.now();
  instance.isEvolved = true;

  player.ownedCards = inventoryToOwnedCards(player.inventory);

  // Legacy decks are card-id based, so replace one matching base entry to keep
  // deck validation compatible after the owned base-card count decreases.
  if (Array.isArray(player.selectedDeck)) {
    const deckIndex = player.selectedDeck.indexOf(fromCardId);
    if (deckIndex !== -1) {
      player.selectedDeck[deckIndex] = toCardId;
    }
  }

  return {
    ok: true,
    instance: { ...instance },
    fromCardId,
    toCardId
  };
}

function upgradeCard(player, instanceId) {
  if (!player) return { ok: false, reason: 'Player not found' };
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return { ok: false, reason: 'Missing instanceId' };
  }

  normalizePlayerInventory(player);

  const instance = getInventoryInstance(player.inventory, instanceId);
  if (!instance) {
    return { ok: false, reason: `Unknown card instance: ${instanceId}` };
  }

  const currentLevel = instance.level || 1;
  if (currentLevel >= MAX_CARD_LEVEL) {
    return { ok: false, reason: `Card is already at max level (${MAX_CARD_LEVEL})` };
  }

  const cost = getUpgradeCost(currentLevel);
  const currency = player.currency || 0;
  if (currency < cost) {
    return { ok: false, reason: `Insufficient ${THEME.currency.short} (need ${cost}, have ${currency})` };
  }

  player.currency -= cost;
  instance.level = currentLevel + 1;

  return {
    ok: true,
    instance: { ...instance },
    previousLevel: currentLevel,
    newLevel: instance.level,
    cost,
    currency: player.currency
  };
}

function createPlayerProgress() {
  const inventory = createInventoryFromCardIds(STARTING_DECK_IDS);
  return {
    currency: 0,
    inventory,
    ownedCards: inventoryToOwnedCards(inventory),
    runRewards: null,
    currencyEarnedThisRun: 0
  };
}

function extractPersistentData(player) {
  normalizePlayerInventory(player);
  return {
    currency: player.currency || 0,
    inventory: player.inventory.map(instance => ({ ...instance })),
    ownedCards: inventoryToOwnedCards(player.inventory),
    selectedDeck: player.selectedDeck || [],
    x: player.x || 0,
    y: player.y || 0.5,
    z: player.z || 0,
    rotation: player.rotation || 0
  };
}

function persistenceKey(playerId) {
  const player = _gameState.players[playerId];
  if (!player) return playerId;
  return player.accountId || playerId;
}

function savePlayerData(playerId) {
  if (!provider) return;
  const player = _gameState.players[playerId];
  if (!player) return;
  try {
    const key = persistenceKey(playerId);
    provider.savePlayer(key, extractPersistentData(player));
  } catch (err) {
    console.error(`[persistence] savePlayerData failed for ${playerId}:`, err.message);
  }
}

function saveAllPlayers() {
  for (const playerId of Object.keys(_gameState.players)) {
    try {
      savePlayerData(playerId);
    } catch (err) {
      console.error(`[persistence] saveAllPlayers failed for ${playerId}:`, err.message);
    }
  }
}

function createRunState() {
  const quest = getSelectedQuest(_gameState);

  if (quest.objectiveType === 'collect_items') {
    const totalItems = Number.isFinite(quest.itemCount) ? quest.itemCount : 1;
    return {
      id: crypto.randomUUID(),
      status: 'playing',
      questId: quest.id,
      questName: quest.name,
      questDescription: quest.description,
      rewardCurrency: quest.rewardCurrency,
      objective: {
        type: 'collect_items',
        label: `${quest.name}: recover ${totalItems} prisms`,
        totalItems,
        collectedItems: 0,
      },
      startedAt: Date.now()
    };
  }

  const objectiveLabel = `${quest.name}: ${quest.description}`;

  return {
    id: crypto.randomUUID(),
    status: 'playing',
    questId: quest.id,
    questName: quest.name,
    questDescription: quest.description,
    rewardCurrency: quest.rewardCurrency,
    objective: {
      type: 'defeat_enemies',
      label: objectiveLabel,
      totalEnemies: _gameState.enemies.length,
      defeatedEnemies: 0
    },
    startedAt: Date.now()
  };
}

function startDungeonRun() {
  _gameState.run = createRunState();
  for (const p of Object.values(_gameState.players)) {
    p.currencyEarnedThisRun = 0;
    p.runRewards = null;
    p.runCardDropIds = [];
    p.pendingCardChoices = null;
    p.claimedCardRewardId = null;
  }
}

function applyTelepipeReadyHand(player) {
  if (!player || !Array.isArray(player.hand)) return;
  const def = CARD_DEFS.telepipe;
  if (!def) return;

  player.hp = MAX_HP;
  player.magicStones = MAX_MAGIC_STONES;

  const replaceSlot = player.hand.findIndex((c) => c);
  if (replaceSlot < 0) return;

  player.hand[replaceSlot] = {
    id: 'telepipe',
    name: def.name,
    type: def.type,
    charges: 1,
    remainingCharges: 1,
    magicStoneCost: def.magicStoneCost || 0,
    effect: 'telepipe',
  };
}

const RUN_SPAWN_OFFSETS = [
  { x: 0, z: 0 },
  { x: 3, z: 0 },
  { x: -3, z: 0 },
  { x: 0, z: 3 },
];

function assignRunSpawnPositions(players) {
  const base = firstRoomPosition();
  const list = Array.isArray(players) ? players : Object.values(players);
  list.forEach((player, index) => {
    if (!player) return;
    const offset = RUN_SPAWN_OFFSETS[index % RUN_SPAWN_OFFSETS.length];
    player.x = base.x + offset.x;
    player.y = 0.5;
    player.z = base.z + offset.z;
  });
}

function repositionPlayersAwayFromPortal(players) {
  const telepipe = _gameState && _gameState.telepipe;
  if (!telepipe) return;

  const list = Array.isArray(players) ? players.filter(Boolean) : Object.values(players).filter(Boolean);
  list.forEach((player, index) => {
    if (!isPlayerActive(player)) return;
    const dist = Math.hypot(player.x - telepipe.x, player.z - telepipe.z);
    if (dist > PORTAL_RADIUS) return;
    // Skip the (0,0) offset so resumed players are not left inside the portal radius.
    const offset = RUN_SPAWN_OFFSETS[(index + 1) % RUN_SPAWN_OFFSETS.length];
    player.x = telepipe.x + offset.x;
    player.y = player.y ?? 0.5;
    player.z = telepipe.z + offset.z;
  });
}

function isPortalEntryGraceActive() {
  const telepipe = _gameState && _gameState.telepipe;
  if (!telepipe || !telepipe.placedAt) return false;
  return Date.now() - telepipe.placedAt < PORTAL_PLACEMENT_GRACE_MS;
}

function cardChoiceDescription(def) {
  if (!def) return '';
  if (def.specialEffect) return def.specialEffect.replace(/_/g, ' ');
  if (def.type === 'weapon') {
    return THEME.cardDescriptions.damageWeapon.replace('{damage}', String(def.damage || 0));
  }
  if (def.type === 'spell') return THEME.cardDescriptions.summonAlly;
  if (def.type === 'creature') return THEME.cardDescriptions.spawnMinion;
  return `${def.type} card`;
}

function getEnemyCardDrop(enemy) {
  if (!enemy) return null;
  if (typeof enemy.cardDrop === 'string' && CARD_DEFS[enemy.cardDrop]) {
    return enemy.cardDrop;
  }
  if (!enemy.type) return null;
  const cardId = ENEMY_CARD_DROPS[enemy.type];
  return cardId && CARD_DEFS[cardId] ? cardId : null;
}

function recordEnemyCardDrop(enemy) {
  const cardId = getEnemyCardDrop(enemy);
  if (!cardId) return;

  const playerId = enemy.lastDamagedBy;
  const player = playerId ? _gameState.players[playerId] : null;
  if (!player) return;

  if (!Array.isArray(player.runCardDropIds)) {
    player.runCardDropIds = [];
  }
  player.runCardDropIds.push(cardId);
}

function getEnemyMagicStoneDrop(enemy) {
  if (!enemy || !enemy.type) return 0;
  return ENEMY_MS_DROPS[enemy.type] ?? 15;
}

function spawnMagicStoneDrop(enemy) {
  const value = getEnemyMagicStoneDrop(enemy);
  if (value <= 0) return;

  const id = crypto.randomUUID();
  _gameState.loot.push({
    id,
    x: enemy.x,
    z: enemy.z,
    value,
    kind: 'magic_stone',
    createdAt: Date.now(),
  });
  console.log(`[loot] magic stone drop id=${id} value=${value} at (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)})`);
}

function buildCardChoices(playerId) {
  const player = _gameState.players[playerId];
  if (!player || !Array.isArray(player.runCardDropIds)) return [];

  const uniqueIds = [];
  for (const cardId of player.runCardDropIds) {
    if (!CARD_DEFS[cardId]) continue;
    if (!uniqueIds.includes(cardId)) uniqueIds.push(cardId);
    if (uniqueIds.length >= MAX_CARD_CHOICES) break;
  }

  return uniqueIds.map((cardId) => {
    const def = CARD_DEFS[cardId];
    return {
      id: cardId,
      name: def.name,
      type: def.type,
      description: cardChoiceDescription(def),
    };
  });
}

function claimCardReward(playerId, cardId) {
  const player = _gameState.players[playerId];
  if (!player || typeof cardId !== 'string') {
    return { ok: false, reason: 'invalid' };
  }
  if (player.claimedCardRewardId) {
    return { ok: false, reason: 'already_claimed' };
  }

  const choices = player.pendingCardChoices || [];
  if (!choices.some((choice) => choice.id === cardId)) {
    return { ok: false, reason: 'invalid_choice' };
  }

  if (!grantCard(player, cardId)) {
    return { ok: false, reason: 'grant_failed' };
  }

  player.claimedCardRewardId = cardId;
  return {
    ok: true,
    cardId,
    ownedCards: player.ownedCards,
    inventory: player.inventory,
  };
}

function clampObjectiveProgress(run) {
  if (run.objective.type === 'collect_items') {
    run.objective.collectedItems = Math.min(run.objective.collectedItems, run.objective.totalItems);
    return;
  }
  run.objective.defeatedEnemies = Math.min(run.objective.defeatedEnemies, run.objective.totalEnemies);
}

function syncRunObjectiveToEnemies() {
  if (!_gameState.run || _gameState.run.objective.type !== 'defeat_enemies') return;
  _gameState.run.objective.totalEnemies = _gameState.enemies.length;
  clampObjectiveProgress(_gameState.run);
}

function recordEnemyDefeated(count = 1) {
  if (!_gameState.run || _gameState.run.objective.type !== 'defeat_enemies') return;
  _gameState.run.objective.defeatedEnemies += count;
  clampObjectiveProgress(_gameState.run);
}

function recordCrystalCollected(count = 1) {
  if (!_gameState.run || _gameState.run.objective.type !== 'collect_items') return;
  _gameState.run.objective.collectedItems += count;
  clampObjectiveProgress(_gameState.run);
}

function isRunObjectiveComplete(objective) {
  if (objective.type === 'collect_items') {
    return objective.collectedItems >= objective.totalItems;
  }
  return objective.defeatedEnemies >= objective.totalEnemies;
}

function buildRunSummary(status) {
  const run = _gameState.run;
  if (!run) return null;

  const players = Object.entries(_gameState.players).map(([id, p]) => ({
    id,
    hp: p.hp,
    dead: p.dead,
    currency: p.currency,
    rewards: buildPlayerRewardSummary(id),
    cardChoices: p.pendingCardChoices || [],
  }));

  return {
    runId: run.id,
    status,
    durationMs: Date.now() - run.startedAt,
    questId: run.questId,
    questName: run.questName,
    objective: { ...run.objective },
    players,
    defeatedEnemies: run.objective.defeatedEnemies,
    currencyCollected: players.reduce((sum, p) => sum + p.currency, 0),
    rewards: {
      currency: run.rewardCurrency ?? 0
    }
  };
}

function grantCard(player, cardId) {
  if (!CARD_DEFS[cardId]) return false;
  normalizePlayerInventory(player);
  player.inventory.push(createCardInstance(cardId));
  player.ownedCards = inventoryToOwnedCards(player.inventory);
  return true;
}

function grantRunRewards(playerId, summary) {
  const player = _gameState.players[playerId];
  if (!player) return;

  const lootCurrency = player.currencyEarnedThisRun || 0;

  if (summary.status === 'victory') {
    const quest = _gameState.run && _gameState.run.questId
      ? getQuest(_gameState.run.questId)
      : getSelectedQuest(_gameState);
    const currencyBonus = (quest && quest.rewardCurrency) || 10;
    player.currency += currencyBonus;

    const cardChoices = buildCardChoices(playerId);
    player.pendingCardChoices = cardChoices;

    const cards = [];
    if (cardChoices.length === 0) {
      if (!_gameState._victoryCounters) _gameState._victoryCounters = {};
      const idx = _gameState._victoryCounters[playerId] || 0;
      const cardId = VICTORY_REWARD_ROTATION[idx % VICTORY_REWARD_ROTATION.length];
      _gameState._victoryCounters[playerId] = idx + 1;

      if (grantCard(player, cardId)) {
        const cardDef = CARD_DEFS[cardId];
        cards.push({ id: cardId, name: cardDef.name, count: 1 });
      }
    }

    player.runRewards = {
      currency: currencyBonus + lootCurrency,
      cards,
      cardChoices,
    };
  } else {
    player.pendingCardChoices = [];
    player.runRewards = {
      currency: lootCurrency,
      cards: [],
      cardChoices: [],
    };
  }
}

function buildPlayerRewardSummary(playerId) {
  const player = _gameState.players[playerId];
  if (!player || !player.runRewards) return { currency: 0, cards: [] };
  return player.runRewards;
}

function validateDeck(deck, ownedOrInventory) {
  if (deck.length < DECK_MIN_SIZE) {
    return { valid: false, reason: `Deck must have at least ${DECK_MIN_SIZE} cards` };
  }
  if (deck.length > DECK_MAX_SIZE) {
    return { valid: false, reason: `Deck can have at most ${DECK_MAX_SIZE} cards` };
  }

  const inventory = Array.isArray(ownedOrInventory) ? normalizeInventory(ownedOrInventory) : null;
  const ownedCards = inventory ? inventoryToOwnedCards(inventory) : (ownedOrInventory || {});
  const usedInstanceIds = new Set();
  const counts = {};
  for (const entry of deck) {
    let cardId = null;

    if (inventory) {
      const instance = getInventoryInstance(inventory, entry);
      if (instance) {
        if (usedInstanceIds.has(instance.instanceId)) {
          return { valid: false, reason: `Duplicate card instance in deck: ${instance.instanceId}` };
        }
        usedInstanceIds.add(instance.instanceId);
        cardId = instance.cardId;
      } else {
        cardId = CARD_DEFS[entry] ? entry : null;
      }
    } else {
      cardId = CARD_DEFS[entry] ? entry : null;
    }

    if (!CARD_DEFS[cardId]) {
      return { valid: false, reason: `Unknown card id: ${entry}` };
    }
    counts[cardId] = (counts[cardId] || 0) + 1;
  }

  for (const [cardId, count] of Object.entries(counts)) {
    const owned = ownedCards[cardId] || 0;
    if (count > owned) {
      return { valid: false, reason: `Not enough copies of ${cardId} (have ${owned}, need ${count})` };
    }
  }

  return { valid: true };
}

function canSellCardInstance(player, cardId, instanceId = null) {
  if (!player) return { ok: false, reason: 'Player not found' };
  normalizePlayerInventory(player);

  let instance = null;
  if (instanceId) {
    instance = getInventoryInstance(player.inventory, instanceId);
    if (!instance) {
      return { ok: false, reason: `Unknown card instance: ${instanceId}` };
    }
    if (cardId && instance.cardId !== cardId) {
      return { ok: false, reason: `Card instance ${instanceId} is not ${cardId}` };
    }
    if (player.selectedDeck.includes(instance.instanceId)) {
      return { ok: false, reason: 'Cannot sell a card required by your selected deck' };
    }
  } else {
    if (!CARD_DEFS[cardId]) {
      return { ok: false, reason: `Unknown card: ${cardId}` };
    }
    instance = findAvailableInventoryInstance(cardId, player.selectedDeck, player.inventory);
    if (!instance) {
      return { ok: false, reason: `Cannot sell ${cardId}: no extra copies or card required by deck` };
    }
  }

  return { ok: true, instance };
}

function sellCard(player, cardId, instanceId = null) {
  const check = canSellCardInstance(player, cardId, instanceId);
  if (!check.ok) return check;

  const instance = check.instance;
  const resolvedCardId = instance.cardId;
  const sellValue = getCardSellValue(resolvedCardId);
  const deckBefore = Array.isArray(player.selectedDeck) ? [...player.selectedDeck] : [];

  player.inventory = player.inventory.filter(entry => entry.instanceId !== instance.instanceId);
  player.ownedCards = inventoryToOwnedCards(player.inventory);
  player.currency = (player.currency || 0) + sellValue;

  const deckCheck = validateDeck(player.selectedDeck, player.inventory);
  if (!deckCheck.valid) {
    player.inventory.push(instance);
    player.ownedCards = inventoryToOwnedCards(player.inventory);
    player.currency -= sellValue;
    player.selectedDeck = deckBefore;
    return { ok: false, reason: deckCheck.reason };
  }

  return {
    ok: true,
    cardId: resolvedCardId,
    instanceId: instance.instanceId,
    currencyGained: sellValue,
    currency: player.currency
  };
}

function cancelTradesForPlayer(pendingTrades, playerId) {
  if (!pendingTrades || !playerId) return [];
  const cancelled = [];
  for (const [tradeId, trade] of Object.entries(pendingTrades)) {
    if (trade.fromPlayerId === playerId || trade.toPlayerId === playerId) {
      cancelled.push({ tradeId, ...trade });
      delete pendingTrades[tradeId];
    }
  }
  return cancelled;
}

function offerCardTrade(pendingTrades, offererId, targetPlayerId, offeredCardId, requestedCardId) {
  if (!pendingTrades) {
    return { ok: false, reason: 'Invalid trade state' };
  }
  if (offererId === targetPlayerId) {
    return { ok: false, reason: 'Cannot trade with yourself' };
  }

  const offerer = _gameState.players[offererId];
  const target = _gameState.players[targetPlayerId];
  if (!offerer) {
    return { ok: false, reason: 'Offerer not found' };
  }
  if (!target) {
    return { ok: false, reason: 'Target player not found' };
  }
  if (!CARD_DEFS[offeredCardId] || !CARD_DEFS[requestedCardId]) {
    return { ok: false, reason: 'Unknown card in trade offer' };
  }

  normalizePlayerInventory(offerer);
  normalizePlayerInventory(target);

  const offeredInstance = findAvailableInventoryInstance(
    offeredCardId,
    offerer.selectedDeck,
    offerer.inventory
  );
  if (!offeredInstance) {
    return { ok: false, reason: `No extra ${offeredCardId} available to offer` };
  }

  const requestedInstance = findAvailableInventoryInstance(
    requestedCardId,
    target.selectedDeck,
    target.inventory
  );
  if (!requestedInstance) {
    return { ok: false, reason: `Target has no extra ${requestedCardId} to trade` };
  }

  const tradeId = crypto.randomUUID();
  pendingTrades[tradeId] = {
    id: tradeId,
    fromPlayerId: offererId,
    toPlayerId: targetPlayerId,
    offeredCardId,
    requestedCardId,
    offeredInstanceId: offeredInstance.instanceId,
    createdAt: Date.now()
  };

  return {
    ok: true,
    tradeId,
    trade: pendingTrades[tradeId],
    targetUsername: target.username || targetPlayerId
  };
}

function respondCardTrade(pendingTrades, responderId, tradeId, accepted) {
  if (!pendingTrades) {
    return { ok: false, reason: 'Invalid trade state' };
  }

  const trade = pendingTrades[tradeId];
  if (!trade || trade.toPlayerId !== responderId) {
    return { ok: false, reason: 'Trade offer not found' };
  }

  if (!accepted) {
    delete pendingTrades[tradeId];
    return { ok: true, accepted: false, tradeId };
  }

  const offerer = _gameState.players[trade.fromPlayerId];
  const responder = _gameState.players[trade.toPlayerId];
  if (!offerer || !responder) {
    delete pendingTrades[tradeId];
    return { ok: false, reason: 'Trade players are no longer available' };
  }

  normalizePlayerInventory(offerer);
  normalizePlayerInventory(responder);

  const offeredInstance = getInventoryInstance(offerer.inventory, trade.offeredInstanceId);
  if (!offeredInstance || offeredInstance.cardId !== trade.offeredCardId) {
    delete pendingTrades[tradeId];
    return { ok: false, reason: 'Offered card is no longer available' };
  }
  if (offerer.selectedDeck.includes(offeredInstance.instanceId)) {
    delete pendingTrades[tradeId];
    return { ok: false, reason: 'Offered card is required by the offerer deck' };
  }

  const requestedInstance = findAvailableInventoryInstance(
    trade.requestedCardId,
    responder.selectedDeck,
    responder.inventory
  );
  if (!requestedInstance) {
    delete pendingTrades[tradeId];
    return { ok: false, reason: 'Requested card is no longer available' };
  }

  offerer.inventory = offerer.inventory.filter(entry => entry.instanceId !== offeredInstance.instanceId);
  responder.inventory = responder.inventory.filter(entry => entry.instanceId !== requestedInstance.instanceId);
  offerer.inventory.push({ ...requestedInstance });
  responder.inventory.push({ ...offeredInstance });
  offerer.ownedCards = inventoryToOwnedCards(offerer.inventory);
  responder.ownedCards = inventoryToOwnedCards(responder.inventory);

  const offererDeckCheck = validateDeck(offerer.selectedDeck, offerer.inventory);
  if (!offererDeckCheck.valid) {
    offerer.inventory = offerer.inventory.filter(entry => entry.instanceId !== requestedInstance.instanceId);
    responder.inventory = responder.inventory.filter(entry => entry.instanceId !== offeredInstance.instanceId);
    offerer.inventory.push({ ...offeredInstance });
    responder.inventory.push({ ...requestedInstance });
    offerer.ownedCards = inventoryToOwnedCards(offerer.inventory);
    responder.ownedCards = inventoryToOwnedCards(responder.inventory);
    delete pendingTrades[tradeId];
    return { ok: false, reason: offererDeckCheck.reason };
  }

  const responderDeckCheck = validateDeck(responder.selectedDeck, responder.inventory);
  if (!responderDeckCheck.valid) {
    offerer.inventory = offerer.inventory.filter(entry => entry.instanceId !== requestedInstance.instanceId);
    responder.inventory = responder.inventory.filter(entry => entry.instanceId !== offeredInstance.instanceId);
    offerer.inventory.push({ ...offeredInstance });
    responder.inventory.push({ ...requestedInstance });
    offerer.ownedCards = inventoryToOwnedCards(offerer.inventory);
    responder.ownedCards = inventoryToOwnedCards(responder.inventory);
    delete pendingTrades[tradeId];
    return { ok: false, reason: responderDeckCheck.reason };
  }

  delete pendingTrades[tradeId];
  return {
    ok: true,
    accepted: true,
    tradeId,
    offererId: offerer.id,
    responderId: responder.id,
    offeredInstanceId: offeredInstance.instanceId,
    requestedInstanceId: requestedInstance.instanceId
  };
}

function canAddCardToDeck(cardId, deck, ownedOrInventory) {
  const inventory = Array.isArray(ownedOrInventory) ? normalizeInventory(ownedOrInventory) : null;
  if (inventory) {
    const instance = getInventoryInstance(inventory, cardId);
    if (instance) return canAddCardInstanceToDeck(instance.instanceId, deck, inventory);
    if (!CARD_DEFS[cardId]) return false;
    return !!findAvailableInventoryInstance(cardId, deck, inventory) && deck.length < DECK_MAX_SIZE;
  }

  const ownedCards = ownedOrInventory || {};
  if (!CARD_DEFS[cardId]) return false;
  if (deck.length >= DECK_MAX_SIZE) return false;

  const currentCount = deck.filter(id => id === cardId).length;
  const owned = ownedCards[cardId] || 0;
  if (currentCount >= owned) return false;

  return true;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Weak, per-player fallback cards when the run deck is exhausted.
const DESPERATION_CARD_DEFS = {
  rusty_shiv: {
    id: 'rusty_shiv',
    name: 'Emergency Shiv',
    type: 'weapon',
    damage: 4,
    charges: 1,
    attackRange: 3.5,
    cooldownMs: 1000,
    effect: 'rusty_shiv',
    specialEffect: 'rusty_shiv',
    isDesperation: true,
  },
  desperate_lunge: {
    id: 'desperate_lunge',
    name: 'Last Gasp',
    type: 'weapon',
    damage: 9,
    selfDamage: 8,
    charges: 1,
    attackRange: 4,
    cooldownMs: 1200,
    isDesperation: true,
  },
  throw_rock: {
    id: 'throw_rock',
    name: 'Debris Toss',
    type: 'weapon',
    damage: 3,
    charges: 1,
    attackRange: 6,
    cooldownMs: 700,
    effect: 'throw_rock',
    specialEffect: 'throw_rock',
    isDesperation: true,
  },
  memory_shard: {
    id: 'memory_shard',
    name: 'Echo Shard',
    type: 'spell',
    charges: 1,
    magicStoneCost: 0,
    effect: 'memory_shard',
    fallbackDamage: 3,
    cooldownMs: 2000,
    isDesperation: true,
  },
};

const DESPERATION_DECK_TEMPLATE = [
  'rusty_shiv',
  'throw_rock',
  'throw_rock',
  'throw_rock',
  'desperate_lunge',
  'desperate_lunge',
  'memory_shard',
];

const MAX_HAND_SLOTS = 4;

function isDeckEmpty(player) {
  return !player || !Array.isArray(player.deck) || player.deck.length === 0;
}

function isDesperationDeckEmpty(player) {
  return !player || !Array.isArray(player.desperationDeck) || player.desperationDeck.length === 0;
}

function getCardDef(cardId) {
  return CARD_DEFS[cardId] || DESPERATION_CARD_DEFS[cardId] || null;
}

function initDesperationDeck(player) {
  player.desperationDeck = DESPERATION_DECK_TEMPLATE.slice();
  shuffleArray(player.desperationDeck);
}

function resetPlayerDesperationState(player) {
  if (!player) return;
  player.inDesperation = false;
  player.exhaustedCards = [];
  initDesperationDeck(player);
}

function ensureDesperationMode(player) {
  if (!player.inDesperation) {
    player.inDesperation = true;
  }
}

function buildDesperationHandCard(def) {
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

function drawCardFromDesperationDeck(player) {
  if (isDesperationDeckEmpty(player)) return null;
  ensureDesperationMode(player);
  const cardId = player.desperationDeck.pop();
  const def = DESPERATION_CARD_DEFS[cardId];
  if (!def) return null;
  return buildDesperationHandCard(def);
}

function recordExhaustedCard(player, card) {
  if (!player || !card || card.isDesperation || card.isEcho) return;
  if (!Array.isArray(player.exhaustedCards)) player.exhaustedCards = [];
  player.exhaustedCards.push({
    id: card.id,
    name: card.name,
    type: card.type,
    grind: card.grind || 0,
    instanceId: card.instanceId || null,
  });
}

function createEchoCard(exhausted) {
  const def = CARD_DEFS[exhausted.id];
  if (!def) return null;

  const echo = {
    id: def.id,
    name: `${def.name} (Echo)`,
    type: def.type,
    charges: 1,
    remainingCharges: 1,
    grind: exhausted.grind || 0,
    isEcho: true,
  };
  if (exhausted.instanceId) {
    echo.instanceId = exhausted.instanceId;
  }
  echo.magicStoneCost = def.magicStoneCost ?? 0;
  if (def.isEvolved) {
    echo.isEvolved = true;
  }
  if (def.specialEffect) {
    echo.specialEffect = def.specialEffect;
  }
  if (def.effect) {
    echo.effect = def.effect;
  }
  if (def.damage != null) {
    echo.echoDamage = Math.max(1, Math.floor(def.damage * 0.5));
  }
  return echo;
}

function pickRandomExhaustedCard(player) {
  const exhausted = Array.isArray(player.exhaustedCards) ? player.exhaustedCards : [];
  if (exhausted.length === 0) return null;
  return exhausted[Math.floor(Math.random() * exhausted.length)];
}

function replaceConsumedCard(player, slotIndex, consumedCard) {
  if (consumedCard && !consumedCard.isDesperation && !consumedCard.isEcho) {
    recordExhaustedCard(player, consumedCard);
  }
  drawReplacementCard(player, slotIndex);
}

function createDrawDeckFromSelectedDeck(player) {
  normalizePlayerInventory(player);
  const deck = player.selectedDeck.filter(entry => {
    if (typeof entry !== 'string') return false;
    if (getInventoryInstance(player.inventory, entry)) return true;
    return !!CARD_DEFS[entry];
  });
  shuffleArray(deck);
  player.deck = deck;
  return deck;
}

function resolveDeckEntry(entry, inventory) {
  const instance = getInventoryInstance(inventory, entry);
  if (instance) {
    return { cardId: instance.cardId, grind: instance.grind || 0, instanceId: instance.instanceId };
  }
  if (CARD_DEFS[entry]) {
    return { cardId: entry, grind: 0, instanceId: null };
  }
  return null;
}

function drawCardFromDeck(player) {
  if (!player.deck || player.deck.length === 0) return null;
  const entry = player.deck.pop();
  const resolved = resolveDeckEntry(entry, player.inventory);
  if (!resolved) return null;
  const def = CARD_DEFS[resolved.cardId];
  if (!def) return null;
  const card = {
    id: def.id,
    name: def.name,
    type: def.type,
    charges: def.charges,
    remainingCharges: def.charges,
    grind: resolved.grind,
  };
  if (resolved.instanceId) {
    card.instanceId = resolved.instanceId;
  }
  if (def.magicStoneCost != null) {
    card.magicStoneCost = def.magicStoneCost;
  }
  if (def.isEvolved) {
    card.isEvolved = true;
  }
  if (def.specialEffect) {
    card.specialEffect = def.specialEffect;
  }
  return card;
}

function initPlayerHand(player) {
  resetPlayerDesperationState(player);
  player.hand = [];
  for (let i = 0; i < MAX_HAND_SLOTS; i++) {
    const card = drawCardFromDeck(player);
    if (card) {
      player.hand.push(card);
    }
  }
  return player.hand;
}

function isPlayerOutOfCards(player) {
  if (!player) return true;
  const cardsInHand = Array.isArray(player.hand) ? player.hand.filter(Boolean).length : 0;
  const handEmpty = cardsInHand === 0;
  return handEmpty && isDeckEmpty(player) && isDesperationDeckEmpty(player);
}

function drawReplacementCard(player, slotIndex) {
  const card = drawCardFromDeck(player) || drawCardFromDesperationDeck(player);
  if (card) {
    player.hand[slotIndex] = card;
  } else {
    player.hand.splice(slotIndex, 1);
  }
  checkRunTerminalState();
}

function validateUseCardHand(player, slotIndex, cardId) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 3) {
    return { valid: false, reason: 'Invalid slot' };
  }
  if (!player || !Array.isArray(player.hand)) {
    return { valid: false, reason: 'Card not in hand' };
  }

  const handCard = player.hand[slotIndex];
  if (!handCard || handCard.id !== cardId) {
    return { valid: false, reason: 'Card not in hand' };
  }

  if (Number.isFinite(handCard.remainingCharges) && handCard.remainingCharges <= 0) {
    return { valid: false, reason: 'No charges remaining' };
  }

  return { valid: true, handCard };
}

function discardCardFromHand(player, slotIndex, cardId) {
  const validation = validateUseCardHand(player, slotIndex, cardId);
  if (!validation.valid) return validation;

  while (player.hand.length <= slotIndex) {
    player.hand.push(null);
  }
  player.hand[slotIndex] = null;
  checkRunTerminalState();
  return { valid: true };
}

function addMagicStones(player, amount) {
  if (!player || !Number.isFinite(amount) || amount <= 0) return 0;
  const before = Number.isFinite(player.magicStones) ? player.magicStones : 0;
  player.magicStones = Math.min(MAX_MAGIC_STONES, before + amount);
  return player.magicStones - before;
}

function restoreCardCharges(card, amount) {
  if (!card || !Number.isFinite(amount) || amount <= 0) return 0;
  const maxCharges = Number.isFinite(card.charges) ? card.charges : 0;
  const before = Number.isFinite(card.remainingCharges) ? card.remainingCharges : maxCharges;
  const after = Math.min(maxCharges, before + amount);
  card.remainingCharges = after;
  return after - before;
}

function restoreHandCharges(player, amount, options = {}) {
  if (!player || !Array.isArray(player.hand)) return [];

  const allowedTypes = options.types ? new Set(options.types) : null;
  const slots = Array.isArray(options.slots)
    ? options.slots
    : player.hand.map((_, index) => index);

  let candidates = slots
    .filter((slotIndex) => slotIndex >= 0 && slotIndex < player.hand.length)
    .map((slotIndex) => ({ slotIndex, card: player.hand[slotIndex] }))
    .filter(({ card }) => {
      if (!card) return false;
      if (allowedTypes && !allowedTypes.has(card.type)) return false;
      return Number.isFinite(card.remainingCharges) && Number.isFinite(card.charges) && card.remainingCharges < card.charges;
    });

  if (options.selection === 'mostDepleted') {
    candidates = candidates.sort((a, b) => {
      const aMissing = a.card.charges - a.card.remainingCharges;
      const bMissing = b.card.charges - b.card.remainingCharges;
      return bMissing - aMissing || a.slotIndex - b.slotIndex;
    });
  } else if (options.selection === 'random' && candidates.length > 1) {
    const start = Math.floor(Math.random() * candidates.length);
    candidates = candidates.slice(start).concat(candidates.slice(0, start));
  }

  const limit = Number.isFinite(options.maxTargets) ? options.maxTargets : candidates.length;
  const restored = [];
  for (const { slotIndex, card } of candidates.slice(0, limit)) {
    const restoredAmount = restoreCardCharges(card, amount);
    if (restoredAmount > 0) {
      restored.push({ slotIndex, cardId: card.id, amount: restoredAmount });
    }
  }
  return restored;
}

function spawnEnemy(x, z, type = 'grunt', spawnedBy) {
  if (!ENEMY_DEFS[type]) {
    throw new Error(`Unknown enemy type: ${type} (valid: ${Object.keys(ENEMY_DEFS).join(', ')})`);
  }
  const def = ENEMY_DEFS[type];
  const enemy = {
    id: crypto.randomUUID(),
    x,
    z,
    type,
    hp: def.hp,
    maxHp: def.hp,
    state: 'idle',
    attackState: 'idle',
    wanderTarget: { x, z }
  };
  if (type === 'spawner') {
    enemy.lastSpawnTime = Date.now();
  }
  if (spawnedBy !== undefined) {
    enemy.spawnedBy = spawnedBy;
  }
  _gameState.enemies.push(enemy);
  return enemy;
}

function removeDeadEnemies() {
  const dying = _gameState.enemies.filter((e) => e.hp <= 0);
  for (const enemy of dying) {
    recordEnemyCardDrop(enemy);
    spawnMagicStoneDrop(enemy);
  }

  const before = _gameState.enemies.length;
  _gameState.enemies = _gameState.enemies.filter((e) => e.hp > 0);
  const removed = before - _gameState.enemies.length;
  if (removed > 0) {
    recordEnemyDefeated(removed);
  }
  return removed;
}

function cleanupAfterDamage() {
  if (removeDeadEnemies() > 0) {
    checkRunTerminalState();
  }
}

function spawnCrystals(layout, rng, count) {
  const itemCount = Math.max(1, count | 0);
  const treasureRooms = roomsByRole(layout, 'treasure');
  const eligibleRooms = layout.rooms.filter(r => r.role !== 'start');
  const roomPool = [];

  if (treasureRooms.length > 0) {
    roomPool.push(treasureRooms[0]);
  }

  const others = eligibleRooms.filter(r => !roomPool.includes(r));
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  roomPool.push(...others);

  if (roomPool.length === 0 && layout.rooms.length > 0) {
    roomPool.push(layout.rooms[0]);
  }

  for (let i = 0; i < itemCount; i++) {
    const room = roomPool[i % roomPool.length];
    const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
    const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
    const pos = {
      x: room.x + (rng() * 2 - 1) * halfW,
      z: room.z + (rng() * 2 - 1) * halfD,
    };
    const id = crypto.randomUUID();
    _gameState.loot.push({
      id,
      x: pos.x,
      z: pos.z,
      value: 0,
      kind: 'crystal',
      createdAt: Date.now(),
    });
    console.log(`[crystal] spawned id=${id} at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
  }
}

function spawnLoot(layout, rng) {
  if (Math.random() >= LOOT_SPAWN_CHANCE) return;

  const treasureRooms = roomsByRole(layout, 'treasure');
  const nonStartRooms = layout.rooms.filter(r => r.role !== 'start');
  let pos;

  if (treasureRooms.length > 0) {
    const room = treasureRooms[Math.floor(rng() * treasureRooms.length)];
    const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
    const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
    pos = {
      x: room.x + (rng() * 2 - 1) * halfW,
      z: room.z + (rng() * 2 - 1) * halfD,
    };
  } else if (nonStartRooms.length > 0) {
    const room = nonStartRooms[Math.floor(rng() * nonStartRooms.length)];
    const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
    const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
    pos = {
      x: room.x + (rng() * 2 - 1) * halfW,
      z: room.z + (rng() * 2 - 1) * halfD,
    };
  } else {
    pos = randomRoomPosition();
  }

  const value = Math.floor(Math.random() * 16) + 5;
  const id = crypto.randomUUID();
  _gameState.loot.push({ id, x: pos.x, z: pos.z, value, createdAt: Date.now() });
  console.log(`[loot] spawned id=${id} value=${value}`);
}

function spawnEnemies() {
  const layout = _gameState.layout;
  const seed = _gameState.layoutSeed || 42;
  const rng = mulberry32(seed + 1000);
  const quest = getSelectedQuest(_gameState);

  if (quest.objectiveType === 'collect_items') {
    const crystalCount = Number.isFinite(quest.itemCount) ? quest.itemCount : 1;
    spawnCrystals(layout, rng, crystalCount);
    return;
  }

  const combatRooms = roomsByRole(layout, 'combat');
  const nonStartRooms = layout.rooms.filter(r => r.role !== 'start');

  const spawnTypes = ['skirmisher', 'skirmisher', 'grunt', 'miniboss', 'spawner'];
  const enemyCount = Number.isFinite(quest.enemyCount) ? quest.enemyCount : spawnTypes.length;
  const typesToSpawn = [];
  for (let i = 0; i < enemyCount; i++) {
    typesToSpawn.push(spawnTypes[i % spawnTypes.length]);
  }

  for (const type of typesToSpawn) {
    let pos;
    if (combatRooms.length > 0) {
      pos = randomRoomPositionByRole(layout, 'combat', rng);
    } else if (nonStartRooms.length > 0) {
      const room = nonStartRooms[Math.floor(rng() * nonStartRooms.length)];
      const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
      const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
      pos = {
        x: room.x + (rng() * 2 - 1) * halfW,
        z: room.z + (rng() * 2 - 1) * halfD,
      };
    } else {
      pos = randomRoomPosition();
    }
    const enemy = spawnEnemy(pos.x, pos.z, type);
    enemy.wanderTarget = randomWanderTarget();
  }

  spawnLoot(layout, rng);
}

function isPlayerActive(player) {
  return !!(player && !player.dead && !player.extracted);
}

function hasActivePlayers() {
  return Object.values(_gameState.players).some(isPlayerActive);
}

function capturePlayerCombatState(player) {
  return {
    x: player.x,
    y: player.y,
    z: player.z,
    rotation: player.rotation,
    hp: player.hp,
    dead: player.dead,
    magicStones: player.magicStones,
    hand: Array.isArray(player.hand) ? player.hand.map((card) => (card ? { ...card } : null)) : [],
    deck: Array.isArray(player.deck) ? [...player.deck] : [],
    slotCooldowns: Array.isArray(player.slotCooldowns) ? [...player.slotCooldowns] : [null, null, null, null],
    currencyEarnedThisRun: player.currencyEarnedThisRun || 0,
    runCardDropIds: Array.isArray(player.runCardDropIds) ? [...player.runCardDropIds] : [],
    inDesperation: !!player.inDesperation,
    desperationDeck: Array.isArray(player.desperationDeck) ? [...player.desperationDeck] : [],
    desperationCardsPlayed: player.desperationCardsPlayed || 0,
    weaponComboCounts: player.weaponComboCounts ? { ...player.weaponComboCounts } : {},
  };
}

function captureRunCheckpoint() {
  const playerStates = {};
  for (const [id, player] of Object.entries(_gameState.players)) {
    playerStates[id] = capturePlayerCombatState(player);
  }

  return {
    version: 1,
    savedAt: Date.now(),
    run: JSON.parse(JSON.stringify(_gameState.run)),
    selectedQuestId: _gameState.selectedQuestId,
    layoutSeed: _gameState.layoutSeed,
    layout: JSON.parse(JSON.stringify(_gameState.layout)),
    dungeonBounds: JSON.parse(JSON.stringify(_gameState.dungeonBounds)),
    walkableAABBs: JSON.parse(JSON.stringify(_gameState.walkableAABBs || [])),
    enemies: JSON.parse(JSON.stringify(_gameState.enemies)),
    minions: JSON.parse(JSON.stringify(_gameState.minions)),
    loot: JSON.parse(JSON.stringify(_gameState.loot)),
    areaEffects: JSON.parse(JSON.stringify(_gameState.areaEffects)),
    telepipe: _gameState.telepipe ? { ..._gameState.telepipe } : null,
    playerStates,
  };
}

function buildSuspendedRunSummary(checkpoint) {
  if (!checkpoint || !checkpoint.run) return null;
  return {
    questId: checkpoint.run.questId,
    questName: checkpoint.run.questName,
    objective: { ...checkpoint.run.objective },
  };
}

function clearSuspendedRunData() {
  _gameState.telepipe = null;
  delete _gameState.suspendedCheckpoint;
}

function restoreRunCheckpoint() {
  const checkpoint = _gameState.suspendedCheckpoint;
  if (!checkpoint) return false;

  _gameState.run = JSON.parse(JSON.stringify(checkpoint.run));
  _gameState.run.status = 'playing';
  _gameState.selectedQuestId = checkpoint.selectedQuestId;
  _gameState.layoutSeed = checkpoint.layoutSeed;
  _gameState.layout = JSON.parse(JSON.stringify(checkpoint.layout));
  _gameState.dungeonBounds = JSON.parse(JSON.stringify(checkpoint.dungeonBounds));
  _gameState.walkableAABBs = JSON.parse(JSON.stringify(checkpoint.walkableAABBs || []));
  _gameState.enemies = JSON.parse(JSON.stringify(checkpoint.enemies));
  _gameState.minions = JSON.parse(JSON.stringify(checkpoint.minions));
  _gameState.loot = JSON.parse(JSON.stringify(checkpoint.loot));
  _gameState.areaEffects = JSON.parse(JSON.stringify(checkpoint.areaEffects));
  _gameState.telepipe = checkpoint.telepipe ? { ...checkpoint.telepipe } : null;

  for (const [id, saved] of Object.entries(checkpoint.playerStates || {})) {
    const player = _gameState.players[id];
    if (!player) continue;
    Object.assign(player, saved);
    player.extracted = false;
    player.ready = false;
    player.pendingSummons = new Set();
    player.lastMoveTime = Date.now();
    player.inputActive = false;
    player.inputDx = 0;
    player.inputDz = 0;
    delete player.lastTelepipeEnterAt;
  }

  if (_gameState.telepipe) {
    _gameState.telepipe.placedAt = Date.now();
  }
  repositionPlayersAwayFromPortal(_gameState.players);

  delete _gameState.suspendedCheckpoint;
  _rebuildWallColliders();
  console.log('[run] checkpoint restored');
  return true;
}

function suspendRunToLobby() {
  if (!_gameState.run || _gameState.run.status !== 'playing') return;

  _gameState.suspendedCheckpoint = captureRunCheckpoint();
  console.log('[run] checkpoint captured');

  _gameState.run.status = 'suspended';
  resetTransientRunState();
  _gameState.telepipe = null;
  _gameState.gamePhase = 'lobby';

  const spawn = firstRoomPosition();
  for (const player of Object.values(_gameState.players)) {
    player.ready = false;
    player.extracted = false;
    player.dead = false;
    player.hp = MAX_HP;
    player.x = spawn.x;
    player.y = 0.5;
    player.z = spawn.z;
    player.lastMoveTime = Date.now();
    player.pendingSummons = new Set();
    player.slotCooldowns = [null, null, null, null];
    player.hand = [];
    player.deck = [];
    player.inputActive = false;
    player.inputDx = 0;
    player.inputDz = 0;
  }

  refreshShopOffer();

  const summary = buildSuspendedRunSummary(_gameState.suspendedCheckpoint);
  console.log(`[run] suspended: ${summary?.questName || _gameState.suspendedCheckpoint?.run?.questName || 'unknown'}`);
  const io = getIoTarget();
  if (io) {
    io.emit('runSuspended', summary);
    io.emit('stateUpdate', stateSnapshot());
  }
  _broadcastLobbyUpdate();
}

function maybeSuspendRun() {
  if (!_gameState.run || _gameState.run.status !== 'playing') return;
  if (hasActivePlayers()) return;
  suspendRunToLobby();
}

function tryEnterTelepipe(playerId) {
  if (!_gameState.run || _gameState.run.status !== 'playing') {
    return { ok: false, reason: 'no_run' };
  }
  if (!_gameState.telepipe) {
    return { ok: false, reason: 'no_portal' };
  }

  const player = _gameState.players[playerId];
  if (!player || player.dead || player.extracted) {
    return { ok: false, reason: 'invalid_player' };
  }

  const dist = Math.hypot(player.x - _gameState.telepipe.x, player.z - _gameState.telepipe.z);
  if (dist > PORTAL_RADIUS) {
    return { ok: false, reason: 'too_far' };
  }

  const now = Date.now();
  if (player.lastTelepipeEnterAt && now - player.lastTelepipeEnterAt < PORTAL_ENTER_COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown' };
  }
  player.lastTelepipeEnterAt = now;

  player.extracted = true;
  player.inputActive = false;
  player.inputDx = 0;
  player.inputDz = 0;
  savePlayerData(playerId);
  console.log(`[telepipe] player ${playerId} extracted`);

  const io = getIoTarget();
  if (io) {
    io.emit('playerExtracted', { playerId });
    io.emit('stateUpdate', stateSnapshot());
  }

  maybeSuspendRun();
  return { ok: true };
}

function checkTelepipeProximity() {
  if (!_gameState.telepipe || !_gameState.run || _gameState.run.status !== 'playing') return;
  if (isPortalEntryGraceActive()) return;

  for (const [playerId, player] of Object.entries(_gameState.players)) {
    if (!isPlayerActive(player)) continue;
    const dist = Math.hypot(player.x - _gameState.telepipe.x, player.z - _gameState.telepipe.z);
    if (dist <= PORTAL_RADIUS) {
      tryEnterTelepipe(playerId);
    }
  }
}

function abandonSuspendedRun() {
  if (!_gameState.suspendedCheckpoint) {
    return { ok: false, reason: 'no_checkpoint' };
  }

  clearSuspendedRunData();
  delete _gameState.run;
  _gameState.gamePhase = 'lobby';

  const spawn = firstRoomPosition();
  for (const player of Object.values(_gameState.players)) {
    player.ready = false;
    player.extracted = false;
    player.dead = false;
    player.hp = MAX_HP;
    player.x = spawn.x;
    player.y = 0.5;
    player.z = spawn.z;
    player.hand = [];
    player.deck = [];
    player.slotCooldowns = [null, null, null, null];
    player.pendingSummons = new Set();
  }

  refreshShopOffer();

  const io = getIoTarget();
  if (io) {
    io.emit('stateUpdate', stateSnapshot());
  }
  _broadcastLobbyUpdate();
  return { ok: true };
}

function checkRunTerminalState() {
  if (!_gameState.run || _gameState.run.status !== 'playing') return;

  let status = null;

  if (isRunObjectiveComplete(_gameState.run.objective)) {
    status = 'victory';
  }

  if (!status) {
    const inDungeon = Object.values(_gameState.players).filter((p) => p && !p.extracted);
    if (inDungeon.length > 0 && inDungeon.every((p) => p.dead || p.hp <= 0)) {
      status = 'failed';
    }
  }

  if (!status) {
    const inDungeon = Object.values(_gameState.players).filter((p) => p && !p.extracted);
    if (inDungeon.length > 0 && inDungeon.every(isPlayerOutOfCards)) {
      status = 'failed';
    }
  }

  if (!status) return;

  clearSuspendedRunData();

  _gameState.run.status = status;

  for (const playerId of Object.keys(_gameState.players)) {
    grantRunRewards(playerId, { status });
  }

  for (const playerId of Object.keys(_gameState.players)) {
    savePlayerData(playerId);
  }

  const summary = buildRunSummary(status);
  const io = getIoTarget();
  if (io) {
    io.emit(status === 'victory' ? 'runComplete' : 'runFailed', summary);
  }
}

function resetTransientRunState() {
  _gameState.enemies = [];
  _gameState.minions = [];
  _gameState.loot = [];
  _gameState.areaEffects = [];
  _gameState.telepipe = null;
}

function stateSnapshot() {
  const players = {};
  for (const [id, p] of Object.entries(_gameState.players)) {
    players[id] = {
      x: p.x,
      y: p.y,
      z: p.z,
      rotation: p.rotation,
      deck: p.deck,
      desperationDeck: Array.isArray(p.desperationDeck) ? [...p.desperationDeck] : [],
      hand: p.hand,
      hp: p.hp,
      dead: p.dead,
      ready: p.ready,
      magicStones: p.magicStones,
      currency: p.currency,
      inDesperation: !!p.inDesperation,
      ownedCards: p.ownedCards ?? (p.inventory ? inventoryToOwnedCards(p.inventory) : undefined),
      runRewards: p.runRewards,
      currencyEarnedThisRun: p.currencyEarnedThisRun,
      selectedDeck: p.selectedDeck,
      inventory: Array.isArray(p.inventory) ? p.inventory.map(instance => ({ ...instance })) : p.inventory,
      debugScenario: p.debugScenario,
      extracted: !!p.extracted,
    };
  }

  return {
    players,
    enemies: _gameState.enemies,
    minions: _gameState.minions,
    loot: _gameState.loot,
    lobby: _gameState.lobby,
    gamePhase: _gameState.gamePhase,
    selectedQuestId: _gameState.selectedQuestId,
    run: _gameState.run,
    dungeonBounds: _gameState.dungeonBounds,
    layoutSeed: _gameState.layoutSeed,
    currency: _gameState.currency,
    shopOffer: ensureShopOffer(),
    telepipe: _gameState.telepipe || null,
    suspendedRunSummary: buildSuspendedRunSummary(_gameState.suspendedCheckpoint),
  };
}

function returnPlayersToLobby() {
  if (!_gameState || !_gameState._lobbyId) {
    throw new Error('returnPlayersToLobby requires lobby context');
  }

  for (const playerId of Object.keys(_gameState.players)) {
    savePlayerData(playerId);
  }

  clearSuspendedRunData();
  resetTransientRunState();

  _gameState.gamePhase = 'lobby';
  delete _gameState.run;

  const spawn = firstRoomPosition();
  for (const playerId of Object.keys(_gameState.players)) {
    const player = _gameState.players[playerId];
    const preservedCurrency = player.currency;
    const preservedInventory = player.inventory;
    const preservedOwnedCards = player.ownedCards || inventoryToOwnedCards(player.inventory);
    const preservedRunRewards = player.runRewards;

    player.ready = false;
    player.dead = false;
    player.extracted = false;
    player.hp = MAX_HP;
    player.x = spawn.x;
    player.y = 0.5;
    player.z = spawn.z;
    player.currency = preservedCurrency;
    player.inventory = preservedInventory;
    player.ownedCards = preservedOwnedCards;
    player.runRewards = preservedRunRewards;
    player.currencyEarnedThisRun = 0;
    player.lastMoveTime = Date.now();
    player.pendingSummons.clear();
    player.slotCooldowns = [null, null, null, null];
  }

  refreshShopOffer();

  if (_gameState._pendingMinionBreaths?.length) {
    _gameState._pendingMinionBreaths.length = 0;
  }

  const io = getIoTarget();
  if (io) {
    io.emit('stateUpdate', stateSnapshot());
  }
  _broadcastLobbyUpdate();
}

function checkAllReady() {
  const all = Object.values(_gameState.players);
  if (all.length > 0 && all.every(p => p.ready)) {
    _gameState.gamePhase = 'playing';

    if (_gameState.suspendedCheckpoint) {
      restoreRunCheckpoint();
      const io = getIoTarget();
      if (io) {
        io.emit('startGame');
        io.emit('stateUpdate', stateSnapshot());
      }
      return;
    }

    assignRunSpawnPositions(all);
    for (const player of all) {
      player.extracted = false;
      player.lastMoveTime = Date.now();
      createDrawDeckFromSelectedDeck(player);
      initPlayerHand(player);
      if (player.debugScenario === 'telepipe-ready') {
        applyTelepipeReadyHand(player);
      }
      player.slotCooldowns = [null, null, null, null];
    }
    spawnEnemies();
    startDungeonRun();
    const io = getIoTarget();
    if (io) {
      io.emit('startGame');
    }
  }
}

module.exports = {
  initProgression,
  setGameState,
  getGameState,
  setBroadcastLobbyUpdate,
  setRebuildWallColliders,
  setTestProvider,
  getProvider,
  CARD_DEFS,
  DESPERATION_CARD_DEFS,
  DESPERATION_DECK_TEMPLATE,
  getCardDef,
  initDesperationDeck,
  drawCardFromDesperationDeck,
  createEchoCard,
  pickRandomExhaustedCard,
  replaceConsumedCard,
  recordExhaustedCard,
  resetPlayerDesperationState,
  STARTING_DECK_IDS,
  EVOLUTION_GRIND_REQUIRED,
  GRIND_COST_BASE,
  GRIND_STAT_SCALE,
  EVOLUTION_TRANSFORMS,
  CARD_SELL_VALUES,
  getCardSellValue,
  getCardBuyValue,
  pickShopOffer,
  refreshShopOffer,
  ensureShopOffer,
  buyShopCard,
  canSellCardInstance,
  sellCard,
  cancelTradesForPlayer,
  offerCardTrade,
  respondCardTrade,
  getGrindCost,
  getStatMultiplier,
  scaledGrindStat,
  grindCard,
  createCardInstance,
  createInventoryFromCardIds,
  createInventoryFromOwnedCards,
  normalizeInventory,
  inventoryToOwnedCards,
  normalizeSelectedDeck,
  normalizePlayerInventory,
  getInventoryInstance,
  cardIdForDeckEntry,
  findAvailableInventoryInstance,
  evolveCard,
  upgradeCard,
  getUpgradeCost,
  getLevelStatMultiplier,
  MAX_CARD_LEVEL,
  UPGRADE_COST_BASE,
  createPlayerProgress,
  extractPersistentData,
  persistenceKey,
  savePlayerData,
  saveAllPlayers,
  createRunState,
  startDungeonRun,
  clampObjectiveProgress,
  syncRunObjectiveToEnemies,
  recordEnemyDefeated,
  getEnemyCardDrop,
  recordEnemyCardDrop,
  getEnemyMagicStoneDrop,
  spawnMagicStoneDrop,
  buildCardChoices,
  claimCardReward,
  buildRunSummary,
  grantCard,
  grantRunRewards,
  buildPlayerRewardSummary,
  validateDeck,
  canAddCardInstanceToDeck,
  canAddCardToDeck,
  createDrawDeckFromSelectedDeck,
  drawCardFromDeck,
  initPlayerHand,
  drawReplacementCard,
  discardCardFromHand,
  isPlayerOutOfCards,
  validateUseCardHand,
  addMagicStones,
  restoreCardCharges,
  restoreHandCharges,
  spawnEnemy,
  removeDeadEnemies,
  cleanupAfterDamage,
  spawnLoot,
  spawnCrystals,
  spawnEnemies,
  recordCrystalCollected,
  isRunObjectiveComplete,
  checkRunTerminalState,
  resetTransientRunState,
  returnPlayersToLobby,
  checkAllReady,
  applyTelepipeReadyHand,
  stateSnapshot,
  isPlayerActive,
  hasActivePlayers,
  captureRunCheckpoint,
  restoreRunCheckpoint,
  suspendRunToLobby,
  maybeSuspendRun,
  tryEnterTelepipe,
  checkTelepipeProximity,
  abandonSuspendedRun,
  buildSuspendedRunSummary,
  clearSuspendedRunData,
};
