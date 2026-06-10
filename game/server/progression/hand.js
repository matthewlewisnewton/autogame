// In-run hand management: slots, draws, discards, desperation deck, passive draw tick.
// Lobby-scoped tick helpers take `state` explicitly (no module-level game state).

const {
  MAX_HAND_SLOTS,
  OPENING_HAND_SIZE,
  HAND_SLOT_FILL_ORDER,
  PASSIVE_DRAW_INTERVAL_MS,
  MAX_MAGIC_STONES,
  TICK_RATE,
} = require('../config');
const { isPlayingPhase } = require('../lobbies');
const CARD_IDENTITY = require('../../shared/cardDefs.json');
const CARD_STATS = require('../../shared/cardStats.json');
const {
  normalizePlayerInventory,
  getInventoryInstance,
  resolveDeckEntry,
} = require('./inventory');

let _onTerminalCheck = () => {};
let _onDeckUpdate = () => {};

function setHandCallbacks({ onTerminalCheck, onDeckUpdate } = {}) {
  if (typeof onTerminalCheck === 'function') _onTerminalCheck = onTerminalCheck;
  if (typeof onDeckUpdate === 'function') _onDeckUpdate = onDeckUpdate;
}

function isPlayerActive(player) {
  return !!(player && !player.dead && !player.extracted);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

function isDeckEmpty(player) {
  return !player || !Array.isArray(player.deck) || player.deck.length === 0;
}

function isDesperationDeckEmpty(player) {
  return !player || !Array.isArray(player.desperationDeck) || player.desperationDeck.length === 0;
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

function drawCardIntoHand(state, player) {
  ensureHandSlots(player);
  const slotIndex = findFirstEmptyHandSlot(player);
  if (slotIndex < 0) return null;
  const card = drawCardFromDeck(player) || drawCardFromDesperationDeck(player);
  if (!card) {
    _onTerminalCheck(state);
    return null;
  }
  player.hand[slotIndex] = card;
  _onTerminalCheck(state);
  _onDeckUpdate(state, player);
  return card;
}

function exhaustHandSlot(state, player, slotIndex, consumedCard) {
  ensureHandSlots(player);
  if (consumedCard && !consumedCard.isDesperation && !consumedCard.isEcho) {
    recordExhaustedCard(player, consumedCard);
  }
  player.hand[slotIndex] = null;
  ensurePassiveDrawScheduled(player);
  _onTerminalCheck(state);
  _onDeckUpdate(state, player);
}

function discardHandSlot(state, player, slotIndex) {
  ensureHandSlots(player);
  player.hand[slotIndex] = null;
  ensurePassiveDrawScheduled(player);
  _onTerminalCheck(state);
  _onDeckUpdate(state, player);
}

function processPassiveDraws(state, now) {
  if (!state || !isPlayingPhase(state)) return;
  for (const player of Object.values(state.players)) {
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
      const drew = drawCardIntoHand(state, player);
      if (drew && canDrawIntoHand(player)) {
        player.nextDrawAt = now + PASSIVE_DRAW_INTERVAL_MS;
      } else {
        player.nextDrawAt = null;
      }
    }
  }
}

function replaceConsumedCard(state, player, slotIndex, consumedCard) {
  exhaustHandSlot(state, player, slotIndex, consumedCard);
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

function releaseBurningCreatureCard(state, player, minion) {
  const match = findBurningHandCardForMinion(player, minion);
  if (!match) return false;
  const { slotIndex, card } = match;
  delete card.activeMinionId;
  delete card.burnMaxTtl;
  replaceConsumedCard(state, player, slotIndex, card);
  return true;
}

function initPlayerHand(state, player) {
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
  _onDeckUpdate(state, player);
  return player.hand;
}

function isPlayerOutOfCards(player) {
  if (!player) return true;
  const cardsInHand = Array.isArray(player.hand) ? player.hand.filter(Boolean).length : 0;
  const handEmpty = cardsInHand === 0;
  return handEmpty && isDeckEmpty(player) && isDesperationDeckEmpty(player);
}

function drawReplacementCard(state, player, slotIndex) {
  ensureHandSlots(player);
  const card = drawCardFromDeck(player) || drawCardFromDesperationDeck(player);
  if (card) {
    player.hand[slotIndex] = card;
  } else {
    player.hand[slotIndex] = null;
  }
  _onTerminalCheck(state);
  _onDeckUpdate(state, player);
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

function discardCardFromHand(state, player, slotIndex, cardId) {
  const validation = validateDiscardHand(player, slotIndex, cardId);
  if (!validation.valid) return validation;

  discardHandSlot(state, player, slotIndex);
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

module.exports = {
  setHandCallbacks,
  CARD_DEFS,
  DESPERATION_CARD_DEFS,
  DESPERATION_DECK_TEMPLATE,
  getCardDef,
  ensureHandSlots,
  countFilledHandSlots,
  findFirstEmptyHandSlot,
  canDrawIntoHand,
  ensurePassiveDrawScheduled,
  drawCardIntoHand,
  exhaustHandSlot,
  discardHandSlot,
  processPassiveDraws,
  isDeckEmpty,
  isDesperationDeckEmpty,
  initDesperationDeck,
  resetPlayerDesperationState,
  ensureDesperationMode,
  buildDesperationHandCard,
  drawCardFromDesperationDeck,
  recordExhaustedCard,
  createEchoCard,
  pickRandomExhaustedCard,
  replaceConsumedCard,
  beginCreatureBurnDown,
  findBurningHandCardForMinion,
  releaseBurningCreatureCard,
  createDrawDeckFromSelectedDeck,
  drawCardFromDeck,
  initPlayerHand,
  isPlayerOutOfCards,
  drawReplacementCard,
  validateUseCardHand,
  validateDiscardHand,
  discardCardFromHand,
  addMagicStones,
  restoreCardCharges,
  restoreHandCharges,
};
