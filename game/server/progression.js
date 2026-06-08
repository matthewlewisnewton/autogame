// ── Server Progression Module ──
// Player persistence, rewards, deck/hand management, run state, spawning, snapshots.
// Imported by index.js; re-exported from index.js for test compatibility.

const { SERVER_TO_CLIENT } = require('../shared/events.js');
const crypto = require('crypto');
const {
  DECK_MIN_SIZE,
  DECK_MAX_SIZE,
  MAX_HP,
  MEDIC_HEAL_COST,
  APPEARANCE_CHANGE_COST,
  MAX_MAGIC_STONES,
  STARTING_MAGIC_STONES,
  SPAWN_PADDING,
  LOOT_SPAWN_CHANCE,
  VICTORY_REWARD_ROTATION,
  ENEMY_CARD_DROPS,
  ENEMY_MS_DROPS,
  ENEMY_CURRENCY_DROP_CHANCE,
  ENEMY_CURRENCY_DROP_PCT_MIN,
  ENEMY_CURRENCY_DROP_PCT_MAX,
  LOOT_DROP_OFFSET_MS,
  LOOT_DROP_OFFSET_CURRENCY,
  MAX_CARD_CHOICES,
  SHOP_CARD_POOL,
  SHOP_PRICE_MULTIPLIER,
  TICK_RATE,
  PORTAL_RADIUS,
  PORTAL_ENTER_COOLDOWN_MS,
  PORTAL_PLACEMENT_GRACE_MS,
  MAX_HAND_SLOTS,
  OPENING_HAND_SIZE,
  HAND_SLOT_FILL_ORDER,
  PASSIVE_DRAW_INTERVAL_MS,
  DIFFICULTY_MINIBOSS_HP_PER_PLAYER,
  difficultyScaleFactor,
  runPlayerCount,
} = require('./config');
const {
  mulberry32,
  roomsByRole,
  randomRoomPositionByRole,
  sampleFloorY,
  DEFAULT_FLOOR_Y,
  resolveFloorY,
  generateHub,
} = require('./dungeon');
const {
  enemyDefFor,
  firstRoomPosition,
  hubSpawnPosition,
  pickFloorSpawnPosition,
  randomWanderTarget,
  spawnVolatileExplosion,
  clearPlayerCardCommitment,
} = require('./simulation');

const HUB_LAYOUT = generateHub(0);
const { applyVariant, getVariantBonusDrop, resolveVariantRollTier, VARIANT_DEFS } = require('./enemyVariants');
const {
  getQuest,
  getSelectedQuest,
  getEnemyPool,
  getGuaranteedEnemyType,
  pickWeightedEnemyType,
  DEFAULT_QUEST_TIER,
} = require('./quests');
const { unlockQuestTier, isQuestTierUnlocked } = require('./users');
const { getObjectiveDef } = require('./objectives');
const { THEME } = require('./theme');
const { DEFAULT_COSMETIC, getHat } = require('./cosmetic');
const CARD_IDENTITY = require('../shared/cardDefs.json');
const CARD_STATS = require('../shared/cardStats.json');
// EVOLUTION_TRANSFORMS and CARD_SELL_VALUES are the single shared sources the
// client (client/cards.js) also consumes, so the two sides cannot drift.
const {
  evolutionTransforms: EVOLUTION_TRANSFORMS,
  cardSellValues: CARD_SELL_VALUES,
} = require('../shared/cardEconomy.json');
const { PHASES, setGamePhase, isLobbyPhase, isPlayingPhase } = require('./lobbies');
const {
  createEncounterState,
  setEncounterBoss,
  ensureEncounterSpawnAnchor,
  isEncounterLocked,
  tryActivateEncounter,
  getEncounterBossId,
  onStageBossDefeated,
} = require('./encounters');

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

function buildPlayerDeckUpdatePayload(player, extra = {}) {
  const payload = {
    deck: Array.isArray(player.deck) ? [...player.deck] : [],
    hand: Array.isArray(player.hand)
      ? player.hand.map((card) => (card ? { ...card } : null))
      : [],
    desperationDeck: Array.isArray(player.desperationDeck) ? [...player.desperationDeck] : [],
    inDesperation: !!player.inDesperation,
    nextDrawAt: player.nextDrawAt ?? null,
    ...extra,
  };
  if (player.runRewards != null) {
    payload.runRewards = player.runRewards;
  }
  if (player.id) {
    const preview = previewReturnRewards(player.id);
    if (preview != null) {
      payload.returnRewardsPreview = preview;
    }
  }
  return payload;
}

function emitPlayerDeckUpdate(playerId, extra = {}) {
  if (!_gameState || !isPlayingPhase(_gameState)) return;
  const player = _gameState.players[playerId];
  if (!player) return;
  const socketId = player.activeSocketId;
  if (!socketId) return;
  const io = _getIo();
  if (!io || typeof io.to !== 'function') return;
  io.to(socketId).emit(SERVER_TO_CLIENT.DECK_UPDATE, buildPlayerDeckUpdatePayload(player, extra));
}

function maybeEmitPlayerDeckUpdate(player) {
  if (!player || !player.id) return;
  emitPlayerDeckUpdate(player.id);
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

// Server-side card definitions, rebuilt from shared single sources:
//   - identity subset (id/name/type/charges/acquisition/rewardOrder) from
//     ../shared/cardDefs.json
//   - full per-card stat objects from ../shared/cardStats.json
// A thin server overlay supplies ONLY the fields that require runtime
// computation and cannot be JSON-encoded (Math.PI-based cone/breath angles and
// astral_guardian's tick-derived attack interval). Everything else lives in the
// shared JSON so the server no longer hand-maintains per-card stats.
const CARD_STAT_OVERLAY = {
  dungeon_drake: { breathConeAngle: Math.PI / 4 },
  bulkhead_mauler: { attackConeAngle: (Math.PI * 2) / 3 },
  ancient_wyrm: { breathConeAngle: Math.PI / 3 },
  harvesting_scythe: { attackConeAngle: Math.PI },
  dragons_breath: { attackConeAngle: Math.PI / 3 },
  // One attack per sim tick at most (TICK_RATE Hz); sub-tick intervals cannot fire faster.
  astral_guardian: { attackIntervalMs: Math.floor(1000 / TICK_RATE) },
};

const CARD_DEFS = Object.fromEntries(
  Object.keys(CARD_IDENTITY).map((id) => [
    id,
    { ...CARD_IDENTITY[id], ...CARD_STATS[id], ...CARD_STAT_OVERLAY[id] },
  ])
);

// Key item definitions registry — mirrors CARD_DEFS pattern.
// Implemented: `dodge_roll`, `summon_recall`. Others return { ok: false, reason: 'not_implemented' }.
const KEY_ITEM_DEFS = {
  dodge_roll: {
    id: 'dodge_roll',
    name: 'Dodge Roll',
    description: 'Quick roll forward with brief invincibility frames',
    cooldownMs: 800,
    type: 'movement',
    invincibleDurationMs: 300,
    rollDistanceMs: 200,
  },
  summon_recall: {
    id: 'summon_recall',
    name: 'Recall Whistle',
    description: 'Recall all your summoned minions to ring positions around you',
    cooldownMs: 10000,
    type: 'summon',
    ringRadiusMin: 1.5,
    ringRadiusMax: 2.5,
  },
  field_medic_kit: {
    id: 'field_medic_kit',
    name: 'Field Medic Kit',
    description: 'Restore Magic Stones for nearby allies in an area',
    cooldownMs: 7000,
    type: 'support',
    healRadius: 5,
    msRestore: 3,
  },
  guard_block: {
    id: 'guard_block',
    name: 'Guard Block',
    description: 'Raise a shield to reduce incoming damage',
    cooldownMs: 3500,
    type: 'defensive',
    damageReduction: 0.7,
    durationMs: 700,
  },
  flare_beacon: {
    id: 'flare_beacon',
    name: 'Flare Beacon',
    description: 'Reveal all enemies in a large radius on your HUD for a few seconds',
    cooldownMs: 10000,
    type: 'utility',
    revealRadius: 25,
    revealDurationMs: 3000,
  },
  loot_magnet: {
    id: 'loot_magnet',
    name: 'Loot Magnet',
    description: 'Attract nearby drops automatically',
    cooldownMs: 8000,
    type: 'utility',
    attractRadius: 8,
  },
  overclock: {
    id: 'overclock',
    name: 'Overclock',
    description: 'Next 2 card uses ignore slot cooldown',
    cooldownMs: 13000,
    type: 'offensive',
    charges: 2,
  },
  smoke_bomb: {
    id: 'smoke_bomb',
    name: 'Smoke Bomb',
    description: 'Drop a smoke zone that conceals players inside it from enemies',
    cooldownMs: 8000,
    type: 'stealth',
    durationMs: 2000,
    radius: 4,
  },
  ground_anchor: {
    id: 'ground_anchor',
    name: 'Ground Anchor',
    description: 'Become immune to knockback and displacement',
    cooldownMs: 6000,
    type: 'defensive',
    durationMs: 1500,
    speedMultiplier: 0.7,
  },
  phase_step: {
    id: 'phase_step',
    name: 'Phase Step',
    description: 'Swap positions with an ally within range',
    cooldownMs: 12000,
    type: 'utility',
    range: 6,
  },
  purge_charm: {
    id: 'purge_charm',
    name: 'Purge Charm',
    description: 'Remove all negative effects',
    cooldownMs: 7000,
    type: 'utility',
  },
  echo_strike: {
    id: 'echo_strike',
    name: 'Echo Strike',
    description: 'Arm an echo: your next weapon hit strikes a second time for 50% damage',
    cooldownMs: 10000,
    type: 'offensive',
    echoFraction: 0.5,
  },
  barrier_dome: {
    id: 'barrier_dome',
    name: 'Barrier Dome',
    description: 'Project a protective dome that blocks incoming projectiles',
    cooldownMs: 14000,
    type: 'defensive',
    radius: 3,
    durationMs: 1000,
  },
  rally_cry: {
    id: 'rally_cry',
    name: 'Rally Cry',
    description: 'Grant a short party-wide move-speed buff to nearby allies',
    cooldownMs: 10000,
    type: 'support',
    radius: 8,
    durationMs: 4000,
    speedMultiplier: 1.1,
  },
};

/** Get a key item definition by ID, or `undefined` for unknown IDs. */
function getKeyItemDef(id) {
  return KEY_ITEM_DEFS[id] || undefined;
}

/** Return all key item definitions (all unlocked at start, no grind gate). */
function getUnlockedKeyItems() {
  return Object.values(KEY_ITEM_DEFS);
}

/** Check if a key item is unlocked for the given player. All 14 are unlocked at start. */
function isKeyItemUnlocked(player, keyItemId) {
  return keyItemId in KEY_ITEM_DEFS;
}

// Starting deck card ids — mirrors createStartingDeck() in client/cards.js.
const STARTING_DECK_IDS = [
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
  if (SHOP_CARD_POOL.length === 0) return null;
  const rng = mulberry32(seed);
  const cardId = SHOP_CARD_POOL[Math.floor(rng() * SHOP_CARD_POOL.length)];
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

function refreshShopOffer(state = _gameState) {
  if (!state) return null;
  const seed = Math.floor(Math.random() * 2147483647);
  let offer = pickShopOffer(seed);
  if (!offer) {
    const fallbackId = SHOP_CARD_POOL[0];
    if (!fallbackId) {
      state.shopOffer = null;
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
  state.shopOffer = offer;
  return state.shopOffer;
}

function ensureShopOffer(state = _gameState) {
  if (!state) return null;
  if (!isValidShopOffer(state.shopOffer)) {
    refreshShopOffer(state);
  }
  return state.shopOffer;
}

/** Clear dead flag for hub UI; HP is unchanged — use healAtMedic() to restore health. */
function revivePlayerInLobby(player) {
  if (!player) return;
  const hp = Number.isFinite(player.hp) ? player.hp : 0;
  if (!player.dead && hp > 0) return;
  player.dead = false;
}

function healAtMedic(playerId, state = _gameState) {
  if (!state || !isLobbyPhase(state)) {
    return { ok: false, reason: 'not_in_lobby' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { ok: false, reason: 'invalid_player' };
  }

  const hp = Number.isFinite(player.hp) ? player.hp : MAX_HP;
  if (hp >= MAX_HP && !player.dead) {
    return { ok: false, reason: 'already_full' };
  }

  const cost = MEDIC_HEAL_COST;
  if ((player.currency || 0) < cost) {
    return { ok: false, reason: 'insufficient_gold' };
  }

  player.currency -= cost;
  player.hp = MAX_HP;
  player.dead = false;
  savePlayerData(playerId);

  return { ok: true, hp: player.hp, currency: player.currency, cost };
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

function createCardInstance(cardId, overrides = {}) {
  if (!CARD_DEFS[cardId]) return null;
  const grind = Number.isFinite(overrides.grind) ? overrides.grind : 0;
  const instanceId = typeof overrides.instanceId === 'string' && overrides.instanceId.length > 0
    ? overrides.instanceId
    : crypto.randomUUID();
  return {
    ...overrides,
    instanceId,
    cardId,
    grind,
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

function applyWyrmMinionBreathStats(minion, cardDef, grind, now) {
  const breathIntervalMs = cardDef.breathIntervalMs ?? 2500;
  minion.breathIntervalMs = breathIntervalMs;
  minion.lastBreathAt = now - breathIntervalMs;
  const baseRange = cardDef.breathRange ?? 6;
  const baseHold = cardDef.breathHoldDistance ?? Math.max(2.5, baseRange * 0.58);
  minion.breathRange = scaledGrindStat(baseRange, grind);
  minion.breathHoldDistance = scaledGrindStat(baseHold, grind);
  minion.breathConeAngle = cardDef.breathConeAngle ?? (Math.PI / 4);
  minion.breathDurationMs = cardDef.breathDurationMs ?? 2000;
  minion.breathTickMs = cardDef.breathTickMs ?? 500;
  minion.burnDurationMs = cardDef.burnDurationMs ?? 0;
  const baseDamage = cardDef.breathDamage ?? cardDef.attackDamage ?? 3;
  minion.breathDamage = scaledGrindStat(baseDamage, grind);
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

/**
 * Deduct the catalog price of a hat from a player's currency. Mirrors the
 * lobby purchase flows (`buyShopCard`/`grindCard`): validates the hat exists
 * and the player can afford it, then subtracts the cost. Does NOT record the
 * unlock — recording on the account is the caller's responsibility.
 *
 * @param {object} player
 * @param {string} hatId
 * @returns {{ ok: true, cost: number, currency: number } | { ok: false, reason: string }}
 */
/**
 * Deduct the appearance-change booth fee from a player's currency. Validates
 * affordability only; persisting the cosmetic is the caller's responsibility.
 *
 * @param {object} player
 * @returns {{ ok: true, cost: number, currency: number } | { ok: false, reason: string }}
 */
function chargeAppearanceChangeForPlayer(player) {
  if (!player) return { ok: false, reason: 'Player not found' };

  const cost = APPEARANCE_CHANGE_COST;
  const currency = player.currency || 0;
  if (currency < cost) {
    return { ok: false, reason: `Not enough ${THEME.currency.short.toLowerCase()} (need ${cost}, have ${currency})` };
  }

  player.currency = currency - cost;

  return {
    ok: true,
    cost,
    currency: player.currency,
  };
}

function unlockHatForPlayer(player, hatId) {
  if (!player) return { ok: false, reason: 'Player not found' };

  const hat = getHat(hatId);
  if (!hat) {
    return { ok: false, reason: `Unknown hat: ${hatId}` };
  }

  const price = Number.isFinite(hat.price) ? hat.price : 0;
  const currency = player.currency || 0;
  if (currency < price) {
    return { ok: false, reason: `Not enough ${THEME.currency.short.toLowerCase()} (need ${price}, have ${currency})` };
  }

  player.currency = currency - price;

  return {
    ok: true,
    cost: price,
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

function createPlayerProgress() {
  const inventory = createInventoryFromCardIds(STARTING_DECK_IDS);
  return {
    currency: 0,
    inventory,
    ownedCards: inventoryToOwnedCards(inventory),
    runRewards: null,
    currencyEarnedThisRun: 0,
    equippedKeyItemId: 'dodge_roll',
    keyItemCooldownUntil: 0,
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
    rotation: player.rotation || 0,
    equippedKeyItemId: player.equippedKeyItemId || 'dodge_roll',
    hp: Number.isFinite(player.hp) ? player.hp : MAX_HP,
    dead: player.dead === true,
    magicStones: Number.isFinite(player.magicStones) ? player.magicStones : STARTING_MAGIC_STONES,
  };
}

function persistenceKey(playerId) {
  const player = _gameState.players[playerId];
  if (!player) return playerId;
  return player.accountId || playerId;
}

function savePlayerData(playerId) {
  if (!provider) return true;
  const player = _gameState.players[playerId];
  if (!player) return true;
  try {
    const key = persistenceKey(playerId);
    provider.savePlayer(key, extractPersistentData(player));
    return true;
  } catch (err) {
    console.error(`[persistence] savePlayerData failed for ${playerId}:`, err.message);
    return false;
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
  const def = getObjectiveDef(quest.objectiveType);
  if (!def) {
    throw new Error(`Unknown objective type: ${quest.objectiveType}`);
  }

  const run = {
    id: crypto.randomUUID(),
    status: 'playing',
    questId: quest.id,
    questTier: quest.tier ?? DEFAULT_QUEST_TIER,
    questName: quest.name,
    questDescription: quest.description,
    rewardCurrency: quest.rewardCurrency,
    objective: def.createObjective(quest, { enemyCount: _gameState.enemies.length }),
    startedAt: Date.now(),
  };

  if (quest.encounter) {
    run.encounter = createEncounterState({
      spawnAnchor: quest.encounter.spawnAnchor ?? null,
    });
  }

  return run;
}

function startDungeonRun() {
  _gameState.run = createRunState();
  if (_gameState._pendingEncounterBossId != null && _gameState.run.encounter) {
    setEncounterBoss(_gameState.run, _gameState._pendingEncounterBossId);
    delete _gameState._pendingEncounterBossId;
  }
  if (_gameState.run.encounter) {
    ensureEncounterSpawnAnchor(_gameState.run, _gameState.enemies);
  }
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
  maybeEmitPlayerDeckUpdate(player);
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
    player.z = base.z + offset.z;
    player.y = resolveFloorY(sampleFloorY(_gameState.layout, player.x, player.z));
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
    player.z = telepipe.z + offset.z;
    player.y = resolveFloorY(sampleFloorY(_gameState.layout, player.x, player.z));
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

  // Variant enemies guarantee a bonus card drop on top of their normal one.
  // The normal type→card mapping is reused; the variant just adds the bonus.
  const bonus = getVariantBonusDrop(enemy);
  if (bonus && bonus.card) {
    player.runCardDropIds.push(cardId);
  }
}

function getEnemyMagicStoneDrop(enemy) {
  if (!enemy || !enemy.type) return 0;
  return ENEMY_MS_DROPS[enemy.type] ?? 15;
}

function getEnemyCurrencyDrop(enemy) {
  if (!enemy || !enemy.type) return 0;
  const msDrop = getEnemyMagicStoneDrop(enemy);
  if (msDrop <= 0) return 0;
  const pctRange = (ENEMY_CURRENCY_DROP_PCT_MAX - ENEMY_CURRENCY_DROP_PCT_MIN) / 100;
  const pct = (ENEMY_CURRENCY_DROP_PCT_MIN / 100) + Math.random() * pctRange;
  return Math.max(1, Math.floor(msDrop * pct));
}

function spawnMagicStoneDrop(enemy) {
  const value = getEnemyMagicStoneDrop(enemy);
  if (value > 0) {
    const id = crypto.randomUUID();
    _gameState.loot.push({
      id,
      x: enemy.x + LOOT_DROP_OFFSET_MS.x,
      z: enemy.z + LOOT_DROP_OFFSET_MS.z,
      value,
      kind: 'magic_stone',
      createdAt: Date.now(),
    });
    console.log(`[loot] magic stone drop id=${id} value=${value} at (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)})`);
  }

  // Variant enemies drop a guaranteed bonus magic stone beyond the normal one.
  // Magnitude comes from the variant registry def, not a hard-coded value here.
  const bonus = getVariantBonusDrop(enemy);
  const bonusValue = bonus ? Number(bonus.magicStone) : 0;
  if (bonusValue > 0) {
    const bonusId = crypto.randomUUID();
    _gameState.loot.push({
      id: bonusId,
      x: enemy.x - LOOT_DROP_OFFSET_MS.x,
      z: enemy.z - LOOT_DROP_OFFSET_MS.z,
      value: bonusValue,
      kind: 'magic_stone',
      createdAt: Date.now(),
    });
    console.log(`[loot] variant bonus magic stone drop id=${bonusId} value=${bonusValue} at (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)})`);
  }
}

function spawnCurrencyDrop(enemy) {
  if (Math.random() >= ENEMY_CURRENCY_DROP_CHANCE) return;

  const value = getEnemyCurrencyDrop(enemy);
  if (value <= 0) return;

  const id = crypto.randomUUID();
  _gameState.loot.push({
    id,
    x: enemy.x + LOOT_DROP_OFFSET_CURRENCY.x,
    z: enemy.z + LOOT_DROP_OFFSET_CURRENCY.z,
    value,
    kind: 'currency',
    createdAt: Date.now(),
  });
  console.log(`[loot] currency drop id=${id} value=${value} at (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)})`);
}

function buildCardChoices(playerId, state = _gameState) {
  const player = state.players[playerId];
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

function claimCardReward(playerId, cardId, state = _gameState) {
  const player = state.players[playerId];
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
  if (!run?.objective) return;
  const def = getObjectiveDef(run.objective.type);
  if (def?.clampProgress) {
    def.clampProgress(run);
    return;
  }
  if (run.objective.totalEnemies != null && run.objective.defeatedEnemies != null) {
    run.objective.defeatedEnemies = Math.min(run.objective.defeatedEnemies, run.objective.totalEnemies);
  }
}

function syncRunObjectiveToEnemies() {
  if (!_gameState.run) return;
  const def = getObjectiveDef(_gameState.run.objective.type);
  if (!def?.syncToEnemyCount) return;
  def.syncToEnemyCount(_gameState.run, _gameState.enemies.length);
}

function recordEnemyDefeated(count = 1) {
  if (!_gameState.run) return;
  const def = getObjectiveDef(_gameState.run.objective.type);
  if (!def?.onEnemyDefeated) return;
  def.onEnemyDefeated(_gameState.run, count);
}

function recordCrystalCollected(count = 1) {
  if (!_gameState.run) return;
  const def = getObjectiveDef(_gameState.run.objective.type);
  if (!def?.onCrystalCollected) return;
  def.onCrystalCollected(_gameState.run, count);
}

function isRunObjectiveComplete(objective) {
  const def = getObjectiveDef(objective.type);
  if (!def) {
    throw new Error(`Unknown objective type: ${objective.type}`);
  }
  return def.isComplete(objective, _gameState.run);
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
    questTier: run.questTier ?? DEFAULT_QUEST_TIER,
    questName: run.questName,
    objective: { ...run.objective },
    players,
    defeatedEnemies: run.objective.defeatedEnemies ?? 0,
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
      ? getQuest(_gameState.run.questId, _gameState.run.questTier)
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

/** Non-mutating preview of rewards if the player returns to guild with the current run state. */
function previewReturnRewards(playerId) {
  const player = _gameState.players[playerId];
  if (!player || !_gameState.run || !isPlayingPhase(_gameState) || !_gameState.run.objective) {
    return null;
  }

  const run = _gameState.run;
  const lootCurrency = player.currencyEarnedThisRun || 0;
  const objectiveComplete = isRunObjectiveComplete(run.objective);
  const quest = run.questId
    ? getQuest(run.questId, run.questTier)
    : getSelectedQuest(_gameState);
  const questBonus = (quest && quest.rewardCurrency) || run.rewardCurrency || 10;

  const base = {
    lootCurrency,
    objectiveComplete,
    runStatus: run.status,
    questBonus,
    giveUpForfeitsCurrency: lootCurrency,
  };

  if (player.runRewards) {
    const rewards = player.runRewards;
    return {
      ...base,
      granted: true,
      currency: rewards.currency || 0,
      cards: (rewards.cards || []).map((c) => ({
        id: c.id,
        name: c.name,
        count: c.count > 1 ? c.count : 1,
      })),
      cardChoices: (rewards.cardChoices || []).map((c) => ({
        id: c.id,
        name: c.name,
      })),
    };
  }

  if (objectiveComplete) {
    const cardChoices = buildCardChoices(playerId);
    const cards = [];
    if (cardChoices.length === 0) {
      cards.push({ id: null, name: 'Bonus card' });
    }
    return {
      ...base,
      granted: false,
      currency: questBonus + lootCurrency,
      cards,
      cardChoices: cardChoices.map((c) => ({ id: c.id, name: c.name })),
    };
  }

  return {
    ...base,
    granted: false,
    currency: lootCurrency,
    cards: [],
    cardChoices: [],
  };
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
    damage: 10,
    selfDamage: 9,
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

function ensureHandSlots(player) {
  if (!player) return;
  if (!Array.isArray(player.hand)) player.hand = [];
  while (player.hand.length < MAX_HAND_SLOTS) {
    player.hand.push(null);
  }
  if (player.hand.length > MAX_HAND_SLOTS) {
    player.hand.length = MAX_HAND_SLOTS;
  }
}

function countFilledHandSlots(player) {
  if (!player || !Array.isArray(player.hand)) return 0;
  return player.hand.filter(Boolean).length;
}

function findFirstEmptyHandSlot(player) {
  ensureHandSlots(player);
  for (const slotIndex of HAND_SLOT_FILL_ORDER) {
    if (!player.hand[slotIndex]) return slotIndex;
  }
  return -1;
}

function canDrawIntoHand(player) {
  return countFilledHandSlots(player) < MAX_HAND_SLOTS
    && (!isDeckEmpty(player) || !isDesperationDeckEmpty(player));
}

function ensurePassiveDrawScheduled(player) {
  if (!player) return;
  if (!canDrawIntoHand(player)) {
    player.nextDrawAt = null;
    return;
  }
  if (player.nextDrawAt == null) {
    player.nextDrawAt = Date.now() + PASSIVE_DRAW_INTERVAL_MS;
  }
}

function drawCardIntoHand(player) {
  ensureHandSlots(player);
  const slotIndex = findFirstEmptyHandSlot(player);
  if (slotIndex < 0) return null;
  const card = drawCardFromDeck(player) || drawCardFromDesperationDeck(player);
  if (!card) {
    checkRunTerminalState();
    return null;
  }
  player.hand[slotIndex] = card;
  checkRunTerminalState();
  maybeEmitPlayerDeckUpdate(player);
  return card;
}

function exhaustHandSlot(player, slotIndex, consumedCard) {
  ensureHandSlots(player);
  if (consumedCard && !consumedCard.isDesperation && !consumedCard.isEcho) {
    recordExhaustedCard(player, consumedCard);
  }
  player.hand[slotIndex] = null;
  ensurePassiveDrawScheduled(player);
  checkRunTerminalState();
  maybeEmitPlayerDeckUpdate(player);
}

function discardHandSlot(player, slotIndex) {
  ensureHandSlots(player);
  player.hand[slotIndex] = null;
  ensurePassiveDrawScheduled(player);
  checkRunTerminalState();
  maybeEmitPlayerDeckUpdate(player);
}

function processPassiveDraws(now) {
  if (!_gameState || !isPlayingPhase(_gameState)) return;
  for (const player of Object.values(_gameState.players)) {
    if (!isPlayerActive(player)) continue;
    if (!canDrawIntoHand(player)) {
      player.nextDrawAt = null;
      continue;
    }
    if (player.nextDrawAt == null) {
      ensurePassiveDrawScheduled(player);
      continue;
    }
    if (now >= player.nextDrawAt) {
      const drew = drawCardIntoHand(player);
      if (drew && canDrawIntoHand(player)) {
        player.nextDrawAt = now + PASSIVE_DRAW_INTERVAL_MS;
      } else {
        player.nextDrawAt = null;
      }
    }
  }
}

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
  exhaustHandSlot(player, slotIndex, consumedCard);
}

function beginCreatureBurnDown(player, slotIndex, handCard, minion) {
  handCard.activeMinionId = minion.id;
  handCard.burnMaxTtl = minion.ttl;
  handCard.remainingCharges = 0;
  minion.sourceSlotIndex = slotIndex;
  minion.sourceCardId = handCard.id;
}

function findBurningHandCardForMinion(player, minion) {
  if (!player || !Array.isArray(player.hand) || !minion) return null;
  const slotIndex = Number.isInteger(minion.sourceSlotIndex) ? minion.sourceSlotIndex : -1;
  if (slotIndex < 0 || slotIndex >= player.hand.length) return null;
  const card = player.hand[slotIndex];
  if (!card || card.activeMinionId !== minion.id) return null;
  return { slotIndex, card };
}

function releaseBurningCreatureCard(player, minion) {
  const match = findBurningHandCardForMinion(player, minion);
  if (!match) return false;
  const { slotIndex, card } = match;
  delete card.activeMinionId;
  delete card.burnMaxTtl;
  replaceConsumedCard(player, slotIndex, card);
  return true;
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
  player.hand = new Array(MAX_HAND_SLOTS).fill(null);
  player.nextDrawAt = null;
  for (let i = 0; i < OPENING_HAND_SIZE; i++) {
    const slotIndex = HAND_SLOT_FILL_ORDER[i];
    const card = drawCardFromDeck(player);
    if (card) {
      player.hand[slotIndex] = card;
    } else {
      break;
    }
  }
  ensurePassiveDrawScheduled(player);
  maybeEmitPlayerDeckUpdate(player);
  return player.hand;
}

function isPlayerOutOfCards(player) {
  if (!player) return true;
  const cardsInHand = Array.isArray(player.hand) ? player.hand.filter(Boolean).length : 0;
  const handEmpty = cardsInHand === 0;
  return handEmpty && isDeckEmpty(player) && isDesperationDeckEmpty(player);
}

function drawReplacementCard(player, slotIndex) {
  ensureHandSlots(player);
  const card = drawCardFromDeck(player) || drawCardFromDesperationDeck(player);
  if (card) {
    player.hand[slotIndex] = card;
  } else {
    player.hand[slotIndex] = null;
  }
  checkRunTerminalState();
  maybeEmitPlayerDeckUpdate(player);
}

function validateUseCardHand(player, slotIndex, cardId) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_HAND_SLOTS) {
    return { valid: false, reason: 'Invalid slot' };
  }
  if (!player || !Array.isArray(player.hand)) {
    return { valid: false, reason: 'Card not in hand' };
  }

  const handCard = player.hand[slotIndex];
  if (!handCard || handCard.id !== cardId) {
    return { valid: false, reason: 'Card not in hand' };
  }

  if (handCard.activeMinionId) {
    return { valid: false, reason: 'Creature still active' };
  }

  if (Number.isFinite(handCard.remainingCharges) && handCard.remainingCharges <= 0) {
    return { valid: false, reason: 'No charges remaining' };
  }

  return { valid: true, handCard };
}

function validateDiscardHand(player, slotIndex, cardId) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_HAND_SLOTS) {
    return { valid: false, reason: 'Invalid slot' };
  }
  if (!player || !Array.isArray(player.hand)) {
    return { valid: false, reason: 'Card not in hand' };
  }

  const handCard = player.hand[slotIndex];
  if (!handCard || handCard.id !== cardId) {
    return { valid: false, reason: 'Card not in hand' };
  }

  if (handCard.activeMinionId) {
    return { valid: false, reason: 'Creature still active' };
  }

  return { valid: true, handCard };
}

function discardCardFromHand(player, slotIndex, cardId) {
  const validation = validateDiscardHand(player, slotIndex, cardId);
  if (!validation.valid) return validation;

  discardHandSlot(player, slotIndex);
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
      if (card.activeMinionId) return false;
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

function spawnEnemy(x, z, type = 'grunt', spawnedBy, opts = {}) {
  const def = enemyDefFor(type);
  const { hp, name, description, surfacedStats, ...statFieldsFromDef } = def;
  const enemy = {
    id: crypto.randomUUID(),
    x,
    z,
    type,
    ...statFieldsFromDef,
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
  // Variant seam, centralized so every spawned enemy exposes `variant` (a tag or
  // null — never undefined). Callers pass the spawn room's encounterTier via
  // opts.tier; quest-tier scaling is resolved here from the active run (or lobby
  // selection). Ad-hoc spawns with no room default encounterTier 0. Rolled once.
  const encounterTier = Number.isFinite(opts.tier) ? opts.tier : 0;
  const questTier = _gameState.run?.questTier ?? _gameState.selectedQuestTier ?? DEFAULT_QUEST_TIER;
  const rollTier = resolveVariantRollTier(questTier, encounterTier);
  applyVariant(enemy, rollTier, opts.rng);
  // Difficulty scaling: miniboss-tier bosses get more HP the larger the party is at spawn.
  // Fixed once here from the live player count — never re-applied retroactively
  // when players later join or leave. 1–4 players stay at baseline (factor 1.0).
  if (type === 'miniboss' || type === 'annex_overseer' || type === 'spire_warden') {
    const factor = difficultyScaleFactor(runPlayerCount(_gameState), DIFFICULTY_MINIBOSS_HP_PER_PLAYER);
    enemy.hp = Math.round(enemy.hp * factor);
    enemy.maxHp = Math.round(enemy.maxHp * factor);
  }
  _gameState.enemies.push(enemy);
  return enemy;
}

function removeDeadEnemies() {
  const dying = _gameState.enemies.filter((e) => e.hp <= 0);
  for (const enemy of dying) {
    recordEnemyCardDrop(enemy);
    spawnMagicStoneDrop(enemy);
    spawnCurrencyDrop(enemy);
    // Volatile-variant enemies detonate a radial blast where they fall before
    // being filtered out of the enemy list.
    const variantDef = enemy.variant ? VARIANT_DEFS[enemy.variant] : null;
    if (variantDef && variantDef.id === 'volatile') {
      spawnVolatileExplosion(enemy.x, enemy.z, variantDef);
    }
  }

  const bossId = getEncounterBossId(_gameState.run);
  if (bossId) {
    const bossDying = dying.find((e) => e.id === bossId);
    if (bossDying) {
      onStageBossDefeated(_gameState, bossDying);
    }
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

/**
 * True for the open-plaza / single-room arena: no room carries a 'combat' or
 * 'treasure' role, so room-relative placement has no role rooms to target and
 * spawning must instead scatter across the open floor with cover-aware sampling.
 */
function isOpenFloorLayout(layout) {
  return roomsByRole(layout, 'combat').length === 0 &&
         roomsByRole(layout, 'treasure').length === 0;
}

function isSunkenCanyonLayout(layout) {
  return !!(layout && layout.profile === 'sunken-canyon');
}

function sunkenCanyonRoomsByBand(layout, band) {
  return layout.rooms.filter(r => r.band === band);
}

function isSpireAscentLayout(layout) {
  return !!(layout && layout.profile === 'spire-ascent');
}

function spireAscentRoomsByTier(layout, tierIndex) {
  return layout.rooms.filter(r => r.band === 'tier' && r.tierIndex === tierIndex);
}

function spireAscentMaxTierIndex(layout) {
  const tiers = layout.rooms.filter(r => r.band === 'tier');
  if (tiers.length === 0) return 0;
  return Math.max(...tiers.map(r => r.tierIndex));
}

function spireAscentTopTierRooms(layout) {
  return spireAscentRoomsByTier(layout, spireAscentMaxTierIndex(layout));
}

function spawnCrystals(layout, rng, count) {
  const itemCount = Math.max(1, count | 0);
  const treasureRooms = roomsByRole(layout, 'treasure');
  const eligibleRooms = layout.rooms.filter(r => r.role !== 'start');
  // Open-plaza / no-role layouts have no treasure/combat room to target, so
  // place objectives across the open floor with the cover-aware helper.
  const openFloor = isOpenFloorLayout(layout);
  const sunkenCanyon = isSunkenCanyonLayout(layout);
  const spireAscent = isSpireAscentLayout(layout);
  const roomPool = [];

  if (spireAscent) {
    const topRooms = spireAscentTopTierRooms(layout);
    if (topRooms.length > 0) {
      roomPool.push(...topRooms);
    } else if (treasureRooms.length > 0) {
      roomPool.push(treasureRooms[0]);
    }
  } else if (sunkenCanyon) {
    const canyonRooms = sunkenCanyonRoomsByBand(layout, 'canyon');
    if (canyonRooms.length > 0) {
      roomPool.push(...canyonRooms);
    } else if (treasureRooms.length > 0) {
      roomPool.push(treasureRooms[0]);
    }
  } else if (treasureRooms.length > 0) {
    roomPool.push(treasureRooms[0]);
  }

  if (!sunkenCanyon && !spireAscent) {
    const others = eligibleRooms.filter(r => !roomPool.includes(r));
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    roomPool.push(...others);
  }

  if (roomPool.length === 0 && layout.rooms.length > 0) {
    roomPool.push(layout.rooms[0]);
  }

  for (let i = 0; i < itemCount; i++) {
    let pos;
    if (openFloor) {
      pos = pickFloorSpawnPosition(layout, rng);
    } else {
      const room = roomPool[i % roomPool.length];
      const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
      const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
      pos = {
        x: room.x + (rng() * 2 - 1) * halfW,
        z: room.z + (rng() * 2 - 1) * halfD,
      };
    }
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

function randomPositionInRoom(room, rng) {
  const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
  const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
  return {
    x: room.x + (rng() * 2 - 1) * halfW,
    z: room.z + (rng() * 2 - 1) * halfD,
  };
}

function nearestCombatRoom(layout) {
  const startRoom = layout.rooms.find(r => r.role === 'start') || layout.rooms[0];
  const combatRooms = roomsByRole(layout, 'combat');
  if (!startRoom || combatRooms.length === 0) return null;

  let nearest = combatRooms[0];
  let nearestDist = Infinity;
  for (const room of combatRooms) {
    const dist = Math.hypot(room.x - startRoom.x, room.z - startRoom.z);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = room;
    }
  }
  return nearest;
}

function pickSunkenCanyonEnemySpawn(layout, rng, spawnIndex, enemyCount) {
  const plateauRooms = sunkenCanyonRoomsByBand(layout, 'plateau');
  const canyonRooms = sunkenCanyonRoomsByBand(layout, 'canyon');
  const plateauSlots = enemyCount >= 2 ? 2 : 1;

  if (spawnIndex < plateauSlots && plateauRooms.length > 0) {
    const room = plateauRooms[Math.floor(rng() * plateauRooms.length)];
    return randomPositionInRoom(room, rng);
  }

  if (canyonRooms.length > 0) {
    const room = canyonRooms[Math.floor(rng() * canyonRooms.length)];
    return randomPositionInRoom(room, rng);
  }

  if (plateauRooms.length > 0) {
    const room = plateauRooms[Math.floor(rng() * plateauRooms.length)];
    return randomPositionInRoom(room, rng);
  }

  return pickFloorSpawnPosition(layout, rng);
}

function pickSpireAscentEnemySpawn(layout, rng, spawnIndex, enemyCount) {
  const tierRooms = layout.rooms.filter(r => r.band === 'tier');
  const maxTier = spireAscentMaxTierIndex(layout);
  const bottomRooms = spireAscentRoomsByTier(layout, 0);
  const topRooms = spireAscentRoomsByTier(layout, maxTier);
  const middleRooms = tierRooms.filter(r => r.tierIndex > 0 && r.tierIndex < maxTier);
  const forceBottom = 1;
  const forceTop = enemyCount >= 2 ? 1 : 0;

  if (spawnIndex < forceBottom && bottomRooms.length > 0) {
    const room = bottomRooms[Math.floor(rng() * bottomRooms.length)];
    return randomPositionInRoom(room, rng);
  }

  if (spawnIndex < forceBottom + forceTop && topRooms.length > 0) {
    const room = topRooms[Math.floor(rng() * topRooms.length)];
    return randomPositionInRoom(room, rng);
  }

  const fillPool = middleRooms.length > 0
    ? [...middleRooms, ...bottomRooms]
    : [...bottomRooms, ...topRooms];
  if (fillPool.length > 0) {
    const room = fillPool[Math.floor(rng() * fillPool.length)];
    return randomPositionInRoom(room, rng);
  }

  return pickFloorSpawnPosition(layout, rng);
}

function pickEnemySpawnPosition(layout, rng, preferNearestCombat, spawnIndex = 0, enemyCount = 1) {
  if (isSunkenCanyonLayout(layout)) {
    return pickSunkenCanyonEnemySpawn(layout, rng, spawnIndex, enemyCount);
  }

  if (isSpireAscentLayout(layout)) {
    return pickSpireAscentEnemySpawn(layout, rng, spawnIndex, enemyCount);
  }

  if (preferNearestCombat) {
    const nearest = nearestCombatRoom(layout);
    if (nearest) return randomPositionInRoom(nearest, rng);
  }

  const combatRooms = roomsByRole(layout, 'combat');

  if (combatRooms.length > 0) {
    return randomRoomPositionByRole(layout, 'combat', rng);
  }
  // Open-plaza / no-role layouts: place enemies across the open floor with a
  // seeded, cover-aware sampler so they never land inside a pillar or wall.
  if (isOpenFloorLayout(layout)) {
    return pickFloorSpawnPosition(layout, rng);
  }
  const nonStartRooms = layout.rooms.filter(r => r.role !== 'start');
  if (nonStartRooms.length > 0) {
    const room = nonStartRooms[Math.floor(rng() * nonStartRooms.length)];
    return randomPositionInRoom(room, rng);
  }
  return pickFloorSpawnPosition(layout, rng);
}

/**
 * Resolve the encounterTier (0–1) of the room containing point (x, z). Used to
 * scale the enemy-variant roll: start/treasure rooms are tier 0 (never roll a
 * variant). Returns 0 when no containing room is found.
 */
function roomTierAt(layout, x, z) {
  if (!layout || !Array.isArray(layout.rooms)) return 0;
  for (const room of layout.rooms) {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    if (x >= room.x - halfW && x <= room.x + halfW &&
        z >= room.z - halfD && z <= room.z + halfD) {
      return Number.isFinite(room.encounterTier) ? room.encounterTier : 0;
    }
  }
  return 0;
}

function buildObjectiveSpawnCtx() {
  return {
    spawnEnemy,
    pickEnemySpawnPosition,
    roomTierAt,
    randomWanderTarget,
    spawnCrystals,
    mulberry32,
  };
}

function spawnCombatEnemies(layout, rng, quest) {
  const def = getObjectiveDef(quest.objectiveType);
  if (def?.skipBulkCombatSpawn?.(quest)) return;

  // Draw each enemy's type from the quest's per-level pool so each level spawns
  // only its thematically-appropriate enemies (and level-exclusive types like
  // `spawner` never leak into other levels). Uses the run's seeded `rng` so
  // type selection stays deterministic for a given seed.
  const enemyPool = getEnemyPool(quest.id, quest.tier);
  const enemyCount = Number.isFinite(quest.enemyCount) ? quest.enemyCount : enemyPool.length;
  const preferNearest = def?.preferNearestEnemySpawns?.(quest) ?? false;
  const nearbyCount = preferNearest ? Math.min(2, enemyCount) : 0;
  // Level-scoped signature foe: if the quest declares a guaranteed enemy type,
  // force the first spawn to it and draw the rest from the weighted pool as
  // usual. Quests without one (`getGuaranteedEnemyType` → null) are unchanged.
  const guaranteedType = enemyCount > 0 ? getGuaranteedEnemyType(quest.id) : null;

  for (let i = 0; i < enemyCount; i++) {
    const type = i === 0 && guaranteedType ? guaranteedType : pickWeightedEnemyType(enemyPool, rng);
    const useNearest = preferNearest && i < nearbyCount;
    const pos = pickEnemySpawnPosition(layout, rng, useNearest, i, enemyCount);
    // Variant seam (centralized in spawnEnemy): encounterTier from the spawn
    // room is combined with run.questTier inside spawnEnemy; seeded rng here.
    const enemy = spawnEnemy(pos.x, pos.z, type, undefined, {
      tier: roomTierAt(layout, pos.x, pos.z),
      rng,
    });
    enemy.wanderTarget = randomWanderTarget();
  }
}

/**
 * Tick-driven spawner for objective types that stagger enemy release (e.g.
 * `survive`). Delegates to the objective registry's `tickSpawns` hook.
 */
function updateSurviveSpawns(now = Date.now()) {
  const run = _gameState.run;
  if (!run?.objective || !isPlayingPhase(_gameState)) return;
  if (isEncounterLocked(run)) return;
  const def = getObjectiveDef(run.objective.type);
  if (!def?.tickSpawns) return;
  def.tickSpawns(now, _gameState, buildObjectiveSpawnCtx());
}

function updateEncounterTriggers() {
  if (!isPlayingPhase(_gameState)) return;
  tryActivateEncounter(_gameState);
}

function spawnLoot(layout, rng) {
  if (Math.random() >= LOOT_SPAWN_CHANCE) return;

  const treasureRooms = roomsByRole(layout, 'treasure');
  const nonStartRooms = layout.rooms.filter(r => r.role !== 'start');
  let pos;

  if (isSpireAscentLayout(layout)) {
    const topRooms = spireAscentTopTierRooms(layout);
    if (topRooms.length > 0) {
      const room = topRooms[Math.floor(rng() * topRooms.length)];
      pos = randomPositionInRoom(room, rng);
    } else {
      pos = pickFloorSpawnPosition(layout, rng);
    }
  } else if (isSunkenCanyonLayout(layout)) {
    const canyonRooms = sunkenCanyonRoomsByBand(layout, 'canyon');
    if (canyonRooms.length > 0) {
      const room = canyonRooms[Math.floor(rng() * canyonRooms.length)];
      pos = randomPositionInRoom(room, rng);
    } else {
      pos = pickFloorSpawnPosition(layout, rng);
    }
  } else if (treasureRooms.length > 0) {
    const room = treasureRooms[Math.floor(rng() * treasureRooms.length)];
    const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
    const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
    pos = {
      x: room.x + (rng() * 2 - 1) * halfW,
      z: room.z + (rng() * 2 - 1) * halfD,
    };
  } else if (isOpenFloorLayout(layout)) {
    // Open-plaza fallback: seeded, cover-aware placement across the open floor
    // (no unseeded Math.random() for the position).
    pos = pickFloorSpawnPosition(layout, rng);
  } else if (nonStartRooms.length > 0) {
    const room = nonStartRooms[Math.floor(rng() * nonStartRooms.length)];
    const halfW = Math.max(0, room.width / 2 - SPAWN_PADDING);
    const halfD = Math.max(0, room.depth / 2 - SPAWN_PADDING);
    pos = {
      x: room.x + (rng() * 2 - 1) * halfW,
      z: room.z + (rng() * 2 - 1) * halfD,
    };
  } else {
    pos = pickFloorSpawnPosition(layout, rng);
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
  const def = getObjectiveDef(quest.objectiveType);
  const spawnCtx = buildObjectiveSpawnCtx();

  if (def?.spawnQuestEntities) {
    def.spawnQuestEntities(layout, rng, quest, _gameState, spawnCtx);
  }

  spawnCombatEnemies(layout, rng, quest);
  spawnLoot(layout, rng);
}

function isPlayerActive(player) {
  return !!(player && !player.dead && !player.extracted);
}

function hasActivePlayers() {
  return Object.values(_gameState.players).some(isPlayerActive);
}

function cloneHandCards(hand) {
  if (!Array.isArray(hand)) return [];
  return hand.map((card) => (card ? { ...card } : card));
}

function capturePlayerCardState(player) {
  return {
    hand: cloneHandCards(player.hand),
    deck: Array.isArray(player.deck) ? [...player.deck] : [],
    inDesperation: !!player.inDesperation,
    nextDrawAt: player.nextDrawAt ?? null,
    desperationDeck: Array.isArray(player.desperationDeck) ? [...player.desperationDeck] : [],
  };
}

function deepCloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function captureWorldState() {
  return {
    enemies: deepCloneJson(_gameState.enemies ?? []),
    minions: deepCloneJson(_gameState.minions ?? []),
    loot: deepCloneJson(_gameState.loot ?? []),
    areaEffects: deepCloneJson(_gameState.areaEffects ?? []),
    iceBalls: deepCloneJson(_gameState.iceBalls ?? []),
    enchantments: deepCloneJson(_gameState.enchantments ?? []),
    telepipe: _gameState.telepipe ? deepCloneJson(_gameState.telepipe) : null,
    layout: _gameState.layout ? deepCloneJson(_gameState.layout) : null,
    layoutSeed: _gameState.layoutSeed ?? null,
    dungeonBounds: _gameState.dungeonBounds ? deepCloneJson(_gameState.dungeonBounds) : null,
  };
}

function captureCardCheckpoint() {
  const run = _gameState.run;
  if (!run) return null;

  const checkpoint = {
    run: {
      id: run.id,
      questId: run.questId,
      questTier: run.questTier ?? DEFAULT_QUEST_TIER,
      questName: run.questName,
      objective: run.objective ? deepCloneJson(run.objective) : null,
      status: run.status,
      startedAt: run.startedAt,
    },
    playerStates: {},
    worldState: captureWorldState(),
  };

  if (run.encounter) {
    checkpoint.run.encounter = deepCloneJson(run.encounter);
  }

  for (const [playerId, player] of Object.entries(_gameState.players)) {
    checkpoint.playerStates[playerId] = capturePlayerCardState(player);
  }

  return checkpoint;
}

function buildSuspendedRunSummary(checkpoint) {
  if (!checkpoint?.run) return null;
  const { run } = checkpoint;
  return {
    questId: run.questId,
    questName: run.questName,
    objective: run.objective ? { ...run.objective } : null,
  };
}

function restoreCardCheckpoint() {
  const checkpoint = _gameState.suspendedCheckpoint;
  if (!checkpoint?.run) return;

  _gameState.run = JSON.parse(JSON.stringify(checkpoint.run));

  const all = Object.values(_gameState.players);
  for (const [playerId, player] of Object.entries(_gameState.players)) {
    const saved = checkpoint.playerStates[playerId];
    if (saved) {
      player.hand = cloneHandCards(saved.hand);
      player.deck = Array.isArray(saved.deck) ? [...saved.deck] : [];
      player.inDesperation = !!saved.inDesperation;
      player.nextDrawAt = saved.nextDrawAt ?? null;
      player.desperationDeck = Array.isArray(saved.desperationDeck) ? [...saved.desperationDeck] : [];
    }
    player.extracted = false;
    player.ready = false;
    player.lastMoveTime = Date.now();
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    player.overclockChargesRemaining = 0;
    player.currencyEarnedThisRun = 0;
    player.runRewards = null;
    player.runCardDropIds = [];
    player.pendingCardChoices = null;
    player.claimedCardRewardId = null;
    clearPlayerCardCommitment(player);
  }

  const world = checkpoint.worldState;
  if (world) {
    if (world.layout != null) {
      _gameState.layout = deepCloneJson(world.layout);
    }
    if (world.layoutSeed != null) {
      _gameState.layoutSeed = world.layoutSeed;
    }
    if (world.dungeonBounds != null) {
      _gameState.dungeonBounds = deepCloneJson(world.dungeonBounds);
    }
    if (world.layout != null) {
      _rebuildWallColliders();
    }

    assignRunSpawnPositions(all);

    _gameState.enemies = deepCloneJson(world.enemies ?? []);
    _gameState.minions = deepCloneJson(world.minions ?? []);
    _gameState.loot = deepCloneJson(world.loot ?? []);
    _gameState.areaEffects = deepCloneJson(world.areaEffects ?? []);
    _gameState.iceBalls = deepCloneJson(world.iceBalls ?? []);
    _gameState.enchantments = deepCloneJson(world.enchantments ?? []);
    _gameState.telepipe = world.telepipe ? deepCloneJson(world.telepipe) : null;

    if (_gameState.telepipe) {
      repositionPlayersAwayFromPortal(all);
    }
  } else {
    assignRunSpawnPositions(all);
  }

  setGamePhase(_gameState, PHASES.PLAYING);

  if (_gameState.run.encounter) {
    ensureEncounterSpawnAnchor(_gameState.run, _gameState.enemies);
  }

  _gameState.suspendedCheckpoint = null;
  console.log('[run] checkpoint restored');

  const io = getIoTarget();
  emitLobbyDeploy(io, SERVER_TO_CLIENT.START_GAME);
  emitLobbyDeploy(io, SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
}

function suspendRunToLobby() {
  if (!_gameState.run || _gameState.run.status !== 'playing') return;

  const questName = _gameState.run.questName || 'unknown';

  _gameState.suspendedCheckpoint = captureCardCheckpoint();
  console.log('[run] checkpoint captured');
  console.log(`[run] extracted to hub: ${questName}`);

  resetTransientRunState();
  delete _gameState.run;
  setGamePhase(_gameState, PHASES.LOBBY);

  const spawn = hubSpawnPosition(HUB_LAYOUT);
  for (const player of Object.values(_gameState.players)) {
    player.ready = false;
    player.extracted = false;
    revivePlayerInLobby(player);
    player.x = spawn.x;
    player.z = spawn.z;
    player.y = resolveFloorY(sampleFloorY(HUB_LAYOUT, player.x, player.z));
    player.lastMoveTime = Date.now();
    player.pendingSummons = new Set();
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    player.hand = [];
    player.deck = [];
    player.inputActive = false;
    player.inputDx = 0;
    player.inputDz = 0;
    player.invulnerableUntil = 0;
    clearPlayerCardCommitment(player);
  }

  refreshShopOffer();

  const suspendedRunSummary = buildSuspendedRunSummary(_gameState.suspendedCheckpoint);
  const io = getIoTarget();
  if (io) {
    io.emit(SERVER_TO_CLIENT.RUN_SUSPENDED, suspendedRunSummary);
    io.emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
  }
  _broadcastLobbyUpdate();
}

function abandonSuspendedRun(state = _gameState) {
  if (!state || !state._lobbyId) {
    throw new Error('abandonSuspendedRun requires lobby context');
  }
  if (!isLobbyPhase(state)) {
    return { ok: false, reason: 'not_lobby' };
  }
  if (!state.suspendedCheckpoint) {
    return { ok: false, reason: 'no_suspended_checkpoint' };
  }

  state.suspendedCheckpoint = null;
  if (state.run) {
    delete state.run;
  }

  for (const player of Object.values(state.players)) {
    player.ready = false;
  }

  const io = getIoTarget();
  if (io) {
    const lobbyId = state._lobbyId;
    if (lobbyId) {
      io.to(lobbyId).emit(SERVER_TO_CLIENT.RUN_ABANDONED);
      io.to(lobbyId).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
    } else {
      io.emit(SERVER_TO_CLIENT.RUN_ABANDONED);
      io.emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
    }
  }
  _broadcastLobbyUpdate();
  return { ok: true };
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
  clearPlayerCardCommitment(player);
  savePlayerData(playerId);
  console.log(`[telepipe] player ${playerId} extracted`);

  const io = getIoTarget();
  if (io) {
    io.emit(SERVER_TO_CLIENT.PLAYER_EXTRACTED, { playerId });
    io.emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
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

  _gameState.run.status = status;

  if (status === 'victory' && (_gameState.run.questTier ?? DEFAULT_QUEST_TIER) === 1) {
    const questId = _gameState.run.questId;
    if (questId) {
      for (const player of Object.values(_gameState.players)) {
        if (player && player.accountId) {
          unlockQuestTier(player.accountId, questId, 2);
        }
      }
    }
  }

  for (const p of Object.values(_gameState.players)) {
    p.overclockChargesRemaining = 0;
  }

  for (const playerId of Object.keys(_gameState.players)) {
    grantRunRewards(playerId, { status });
  }

  for (const playerId of Object.keys(_gameState.players)) {
    savePlayerData(playerId);
  }

  const summary = buildRunSummary(status);
  const io = getIoTarget();
  if (io) {
    io.emit(status === 'victory' ? SERVER_TO_CLIENT.RUN_COMPLETE : SERVER_TO_CLIENT.RUN_FAILED, summary);
  }
}

function resetTransientRunState() {
  _gameState.enemies = [];
  _gameState.minions = [];
  _gameState.loot = [];
  _gameState.areaEffects = [];
  _gameState.iceBalls = [];
  _gameState.telepipe = null;
}

function buildPlayerHotSnapshot(id, p) {
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    rotation: p.rotation,
    hp: p.hp,
    dead: p.dead,
    ready: p.ready,
    magicStones: p.magicStones,
    currency: p.currency,
    extracted: !!p.extracted,
    equippedKeyItemId: p.equippedKeyItemId || 'dodge_roll',
    keyItemCooldownRemaining: Math.max(0, (p.keyItemCooldownUntil || 0) - Date.now()),
    overclockChargesRemaining: p.overclockChargesRemaining || 0,
    isInvulnerable: Date.now() < (p.invulnerableUntil || 0),
    isBlocking: Date.now() < (p.blockingUntil || 0),
    blockingUntil: p.blockingUntil || 0,
    blockingYaw: p.blockingYaw || 0,
    barrierDomeUntil: p.barrierDomeUntil || 0,
    barrierDomeRadius: p.barrierDomeRadius || 0,
    smokeBombUntil: p.smokeBombUntil || 0,
    smokeBombRadius: p.smokeBombRadius || 0,
    smokeBombX: p.smokeBombX || 0,
    smokeBombZ: p.smokeBombZ || 0,
    slowedUntil: p.slowedUntil || 0,
    slowFactor: p.slowFactor || 1,
    burningUntil: p.burningUntil || 0,
    cardUseState: p.cardUseState || null,
    cardWindupUntil: p.cardUseState === 'windup' && p.cardWindupStartTime && p.cardWindupMs
      ? (p.pendingCardUse
        ? Math.max(Date.now(), p.cardWindupStartTime + p.cardWindupMs)
        : p.cardWindupStartTime + p.cardWindupMs)
      : 0,
    cardWindupCardId: p.pendingCardUse?.cardId || null,
    cosmetic: p.cosmetic ?? { ...DEFAULT_COSMETIC },
    username: p.username,
  };
}

function buildPlayerColdSnapshot(id, p) {
  return {
    deck: p.deck,
    desperationDeck: Array.isArray(p.desperationDeck) ? [...p.desperationDeck] : [],
    hand: p.hand,
    inDesperation: !!p.inDesperation,
    nextDrawAt: p.nextDrawAt ?? null,
    ownedCards: p.ownedCards ?? (p.inventory ? inventoryToOwnedCards(p.inventory) : undefined),
    runRewards: p.runRewards,
    currencyEarnedThisRun: p.currencyEarnedThisRun,
    selectedDeck: p.selectedDeck,
    inventory: p.inventory,
    debugScenario: p.debugScenario,
    returnRewardsPreview: previewReturnRewards(id),
  };
}

function buildWorldSnapshot(shopOffer) {
  return {
    enemies: _gameState.enemies,
    minions: _gameState.minions,
    loot: _gameState.loot,
    iceBalls: _gameState.iceBalls || [],
    lobby: _gameState.lobby,
    gamePhase: _gameState.gamePhase,
    selectedQuestId: _gameState.selectedQuestId,
    selectedQuestTier: _gameState.selectedQuestTier ?? DEFAULT_QUEST_TIER,
    run: _gameState.run,
    dungeonBounds: _gameState.dungeonBounds,
    layoutSeed: _gameState.layoutSeed,
    currency: _gameState.currency,
    shopOffer,
    telepipe: _gameState.telepipe || null,
    suspendedRunSummary: _gameState.suspendedCheckpoint
      ? buildSuspendedRunSummary(_gameState.suspendedCheckpoint)
      : null,
  };
}

function hotStateSnapshot() {
  const shopOffer = ensureShopOffer();

  const players = {};
  for (const [id, p] of Object.entries(_gameState.players)) {
    players[id] = buildPlayerHotSnapshot(id, p);
  }

  return {
    players,
    ...buildWorldSnapshot(shopOffer),
  };
}

function stateSnapshot() {
  const shopOffer = ensureShopOffer();

  const players = {};
  for (const [id, p] of Object.entries(_gameState.players)) {
    players[id] = {
      ...buildPlayerHotSnapshot(id, p),
      ...buildPlayerColdSnapshot(id, p),
    };
  }

  return {
    players,
    ...buildWorldSnapshot(shopOffer),
  };
}

function returnPlayersToLobby(state = _gameState) {
  if (!state || !state._lobbyId) {
    throw new Error('returnPlayersToLobby requires lobby context');
  }

  resetTransientRunState();

  state.suspendedCheckpoint = null;
  setGamePhase(state, PHASES.LOBBY);
  delete state.run;

  const spawn = hubSpawnPosition(HUB_LAYOUT);
  for (const playerId of Object.keys(state.players)) {
    const player = state.players[playerId];
    const preservedCurrency = player.currency;
    const preservedInventory = player.inventory;
    const preservedOwnedCards = player.ownedCards || inventoryToOwnedCards(player.inventory);
    const preservedRunRewards = player.runRewards;

    revivePlayerInLobby(player);
    player.ready = false;
    player.extracted = false;
    player.x = spawn.x;
    player.z = spawn.z;
    player.y = resolveFloorY(sampleFloorY(HUB_LAYOUT, player.x, player.z));
    player.currency = preservedCurrency;
    player.inventory = preservedInventory;
    player.ownedCards = preservedOwnedCards;
    player.runRewards = preservedRunRewards;
    player.currencyEarnedThisRun = 0;
    player.lastMoveTime = Date.now();
    player.pendingSummons.clear();
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    player.invulnerableUntil = 0;
    player.overclockChargesRemaining = 0;
    clearPlayerCardCommitment(player);
  }

  refreshShopOffer();

  if (state._pendingMinionBreaths?.length) {
    state._pendingMinionBreaths.length = 0;
  }

  for (const playerId of Object.keys(state.players)) {
    savePlayerData(playerId);
  }

  const io = getIoTarget();
  if (io) {
    io.emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
  }
  _broadcastLobbyUpdate();
}

function giveUpRun(state = _gameState) {
  if (!state || !state._lobbyId) {
    throw new Error('giveUpRun requires lobby context');
  }
  if (!isPlayingPhase(state) || !state.run) {
    return { ok: false, reason: 'no_active_run' };
  }

  resetTransientRunState();

  state.suspendedCheckpoint = null;
  setGamePhase(state, PHASES.LOBBY);
  delete state.run;

  const spawn = firstRoomPosition();
  for (const playerId of Object.keys(state.players)) {
    const player = state.players[playerId];
    const earned = player.currencyEarnedThisRun || 0;
    if (earned > 0) {
      player.currency = Math.max(0, (player.currency || 0) - earned);
    }

    revivePlayerInLobby(player);
    player.ready = false;
    player.extracted = false;
    player.x = spawn.x;
    player.z = spawn.z;
    player.y = resolveFloorY(sampleFloorY(state.layout, player.x, player.z));
    player.currencyEarnedThisRun = 0;
    player.runRewards = null;
    player.hand = [];
    player.deck = [];
    resetPlayerDesperationState(player);
    player.lastMoveTime = Date.now();
    if (!player.pendingSummons) {
      player.pendingSummons = new Set();
    } else {
      player.pendingSummons.clear();
    }
    player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
    player.inputActive = false;
    player.inputDx = 0;
    player.inputDz = 0;
    player.overclockChargesRemaining = 0;
    clearPlayerCardCommitment(player);
  }

  for (const playerId of Object.keys(state.players)) {
    savePlayerData(playerId);
  }

  refreshShopOffer();

  if (state._pendingMinionBreaths?.length) {
    state._pendingMinionBreaths.length = 0;
  }

  const io = getIoTarget();
  if (io) {
    io.emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
  }
  _broadcastLobbyUpdate();
  return { ok: true };
}

function emitLobbyDeploy(io, event, payload) {
  if (!io) return;
  const lobbyId = _gameState && _gameState._lobbyId;
  try {
    if (lobbyId) {
      io.to(lobbyId).emit(event, payload);
    } else {
      io.emit(event, payload);
    }
  } catch (err) {
    console.error(`[checkAllReady] ${event} emit failed:`, err && err.stack ? err.stack : err);
  }
}

function checkAllReady() {
  try {
    checkAllReadyInner();
  } catch (err) {
    console.error('[checkAllReady] failed:', err && err.stack ? err.stack : err);
  }
}

function checkAllReadyInner() {
  if (!isLobbyPhase(_gameState)) return;

  const all = Object.values(_gameState.players);
  const connectedPlayers = all.filter(p => p.connected !== false);
  const allConnectedReady = connectedPlayers.length > 0 && connectedPlayers.every(p => p.ready);
  const noStaleDisconnectReady = all.every(p => p.connected !== false || !p.ready);
  if (allConnectedReady && noStaleDisconnectReady) {
    const selectedTier = _gameState.selectedQuestTier ?? DEFAULT_QUEST_TIER;
    if (selectedTier >= 2) {
      const questId = _gameState.selectedQuestId;
      let clearedAny = false;
      for (const player of connectedPlayers) {
        if (player.ready && !isQuestTierUnlocked(player.accountId, questId, selectedTier)) {
          player.ready = false;
          clearedAny = true;
        }
      }
      if (clearedAny) {
        _broadcastLobbyUpdate();
        return;
      }
    }

    if (!isLobbyPhase(_gameState)) return;

    try {
      if (_gameState.suspendedCheckpoint) {
        restoreCardCheckpoint();
        return;
      }

      setGamePhase(_gameState, PHASES.PLAYING);

      assignRunSpawnPositions(all);
      for (const player of all) {
        const deployHp = Number.isFinite(player.hp) ? player.hp : null;
        const deployMagicStones = Number.isFinite(player.magicStones) ? player.magicStones : null;
        player.extracted = false;
        player.lastMoveTime = Date.now();
        createDrawDeckFromSelectedDeck(player);
        initPlayerHand(player);
        if (player.debugScenario === 'telepipe-ready') {
          applyTelepipeReadyHand(player);
        }
        player.slotCooldowns = new Array(MAX_HAND_SLOTS).fill(null);
        if (deployMagicStones != null) {
          player.magicStones = deployMagicStones;
        } else {
          player.magicStones = STARTING_MAGIC_STONES;
        }
        if (deployHp != null) {
          player.hp = deployHp;
        } else {
          player.hp = MAX_HP;
          player.dead = false;
        }
        player.overclockChargesRemaining = 0;
      }
      spawnEnemies();
      startDungeonRun();
      const io = getIoTarget();
      emitLobbyDeploy(io, SERVER_TO_CLIENT.START_GAME);
      emitLobbyDeploy(io, SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
    } catch (err) {
      console.error('[checkAllReady] deploy failed:', err && err.stack ? err.stack : err);
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
  KEY_ITEM_DEFS,
  getKeyItemDef,
  getUnlockedKeyItems,
  isKeyItemUnlocked,
  DESPERATION_CARD_DEFS,
  DESPERATION_DECK_TEMPLATE,
  getCardDef,
  initDesperationDeck,
  drawCardFromDesperationDeck,
  createEchoCard,
  pickRandomExhaustedCard,
  replaceConsumedCard,
  exhaustHandSlot,
  discardHandSlot,
  drawCardIntoHand,
  ensurePassiveDrawScheduled,
  processPassiveDraws,
  canDrawIntoHand,
  countFilledHandSlots,
  beginCreatureBurnDown,
  releaseBurningCreatureCard,
  findBurningHandCardForMinion,
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
  revivePlayerInLobby,
  healAtMedic,
  buyShopCard,
  canSellCardInstance,
  sellCard,
  cancelTradesForPlayer,
  offerCardTrade,
  respondCardTrade,
  getGrindCost,
  getStatMultiplier,
  scaledGrindStat,
  applyWyrmMinionBreathStats,
  grindCard,
  unlockHatForPlayer,
  chargeAppearanceChangeForPlayer,
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
  getEnemyCurrencyDrop,
  spawnMagicStoneDrop,
  spawnCurrencyDrop,
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
  validateDiscardHand,
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
  spawnCombatEnemies,
  updateSurviveSpawns,
  updateEncounterTriggers,
  recordCrystalCollected,
  isRunObjectiveComplete,
  checkRunTerminalState,
  resetTransientRunState,
  returnPlayersToLobby,
  giveUpRun,
  checkAllReady,
  assignRunSpawnPositions,
  applyTelepipeReadyHand,
  stateSnapshot,
  hotStateSnapshot,
  buildWorldSnapshot,
  isPlayerActive,
  hasActivePlayers,
  restoreCardCheckpoint,
  suspendRunToLobby,
  abandonSuspendedRun,
  maybeSuspendRun,
  tryEnterTelepipe,
  checkTelepipeProximity,
  previewReturnRewards,
  emitPlayerDeckUpdate,
  buildPlayerDeckUpdatePayload,
};
