// Shop offers, medic healing, card buy/sell, grind/evolve, and card-economy helpers.
// Lobby-scoped functions take `state` as the first parameter (no module-level game state).

const {
  MAX_HP,
  MEDIC_HEAL_COST,
  APPEARANCE_CHANGE_COST,
  SHOP_CARD_POOL,
  SHOP_PRICE_MULTIPLIER,
  TICK_RATE,
} = require('../config');
const { mulberry32 } = require('../dungeon');
const { isLobbyPhase } = require('../lobbies');
const { THEME } = require('../theme');
const { getHat } = require('../cosmetic');
const CARD_IDENTITY = require('../../shared/cardDefs.json');
const CARD_STATS = require('../../shared/cardStats.json');
const {
  evolutionTransforms: EVOLUTION_TRANSFORMS,
  cardSellValues: CARD_SELL_VALUES,
} = require('../../shared/cardEconomy.json');

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

// Early export so inventory.js can import migrateCardId without a circular-load hole.
exports.migrateCardId = migrateCardId;

const { savePlayerData } = require('./persistence');

function inventory() {
  return require('./inventory');
}

const CARD_STAT_OVERLAY = {
  dungeon_drake: { breathConeAngle: Math.PI / 4 },
  bulkhead_mauler: { attackConeAngle: (Math.PI * 2) / 3 },
  ancient_wyrm: { breathConeAngle: Math.PI / 3 },
  harvesting_scythe: { attackConeAngle: Math.PI },
  reapers_scythe: { attackConeAngle: Math.PI },
  dragons_breath: { attackConeAngle: Math.PI / 3 },
  astral_guardian: { attackIntervalMs: Math.floor(1000 / TICK_RATE) },
};

const CARD_DEFS = Object.fromEntries(
  Object.keys(CARD_IDENTITY).map((id) => [
    id,
    { ...CARD_IDENTITY[id], ...CARD_STATS[id], ...CARD_STAT_OVERLAY[id] },
  ])
);

const EVOLUTION_GRIND_REQUIRED = 10;
const GRIND_COST_BASE = 100;
const GRIND_STAT_SCALE = 0.05;
const CARD_GRIND_STAT_SCALE = {
  battle_familiar: 0.03,
  null_crawler: 0.03,
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
  if (SHOP_CARD_POOL.length === 0) return null;
  const rng = mulberry32(seed);
  const cardId = SHOP_CARD_POOL[Math.floor(rng() * SHOP_CARD_POOL.length)];
  const def = CARD_DEFS[cardId];
  return {
    cardId,
    name: def.name,
    price: getCardBuyValue(cardId),
    type: def.type,
  };
}

function isValidShopOffer(offer) {
  return !!(offer && typeof offer.cardId === 'string' && CARD_DEFS[offer.cardId]);
}

function refreshShopOffer(state) {
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
      type: def.type,
    };
  }
  state.shopOffer = offer;
  return state.shopOffer;
}

function ensureShopOffer(state) {
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

function healAtMedic(playerId, state) {
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
  savePlayerData(state, playerId);

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

  const {
    normalizePlayerInventory,
    createCardInstance,
    inventoryToOwnedCards,
    canAddCardInstanceToDeck,
    validateDeck,
  } = inventory();
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
    currency: player.currency,
  };
}

function getGrindCost(grind) {
  const level = Number.isFinite(grind) ? Math.max(0, Math.floor(grind)) : 0;
  return GRIND_COST_BASE * (level + 1);
}

function getGrindStatScale(cardId) {
  if (cardId && Object.prototype.hasOwnProperty.call(CARD_GRIND_STAT_SCALE, cardId)) {
    return CARD_GRIND_STAT_SCALE[cardId];
  }
  return GRIND_STAT_SCALE;
}

function getStatMultiplier(grind, cardId) {
  const level = Number.isFinite(grind) ? Math.max(0, Math.floor(grind)) : 0;
  return 1.0 + (level * getGrindStatScale(cardId));
}

function scaledGrindStat(baseValue, grind, cardId) {
  if (!Number.isFinite(baseValue)) return baseValue;
  return Math.round(baseValue * getStatMultiplier(grind, cardId));
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

  const { normalizePlayerInventory, getInventoryInstance } = inventory();
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
    currency: player.currency,
  };
}

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
    currency: player.currency,
  };
}

function evolveCard(player, instanceId) {
  if (!player) return { ok: false, reason: 'Player not found' };
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return { ok: false, reason: 'Missing instanceId' };
  }

  const {
    normalizePlayerInventory,
    getInventoryInstance,
    inventoryToOwnedCards,
  } = inventory();
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
    toCardId,
  };
}

function canSellCardInstance(player, cardId, instanceId = null) {
  if (!player) return { ok: false, reason: 'Player not found' };
  const {
    normalizePlayerInventory,
    getInventoryInstance,
    findAvailableInventoryInstance,
  } = inventory();
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

  const { inventoryToOwnedCards, validateDeck } = inventory();
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
    currency: player.currency,
  };
}

module.exports = {
  migrateCardId,
  EVOLUTION_GRIND_REQUIRED,
  GRIND_COST_BASE,
  GRIND_STAT_SCALE,
  CARD_GRIND_STAT_SCALE,
  EVOLUTION_TRANSFORMS,
  CARD_SELL_VALUES,
  getCardSellValue,
  getCardBuyValue,
  pickShopOffer,
  isValidShopOffer,
  refreshShopOffer,
  ensureShopOffer,
  revivePlayerInLobby,
  healAtMedic,
  buyShopCard,
  canSellCardInstance,
  sellCard,
  getGrindCost,
  getGrindStatScale,
  getStatMultiplier,
  scaledGrindStat,
  applyWyrmMinionBreathStats,
  grindCard,
  evolveCard,
  unlockHatForPlayer,
  chargeAppearanceChangeForPlayer,
};
