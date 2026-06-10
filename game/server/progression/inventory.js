// Card-instance creation, inventory normalization, and deck validation.

const crypto = require('crypto');
const { DECK_MIN_SIZE, DECK_MAX_SIZE } = require('../config');
const CARD_IDENTITY = require('../../shared/cardDefs.json');

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

function isValidCardId(cardId) {
  const id = migrateCardId(cardId);
  return id in CARD_IDENTITY;
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

function createCardInstance(cardId, overrides = {}) {
  if (!isValidCardId(cardId)) return null;
  const grind = Number.isFinite(overrides.grind) ? overrides.grind : 0;
  const instanceId = typeof overrides.instanceId === 'string' && overrides.instanceId.length > 0
    ? overrides.instanceId
    : crypto.randomUUID();
  return {
    ...overrides,
    instanceId,
    cardId: migrateCardId(cardId),
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
    if (!isValidCardId(cardId)) continue;
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
    if (!entry || typeof entry !== 'object' || !isValidCardId(cardId)) continue;
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
    if (!instance || !isValidCardId(instance.cardId)) continue;
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
  return isValidCardId(cardId) ? cardId : null;
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
    if (isValidCardId(migratedEntry)) {
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
  if (!isValidCardId(cardId) || !Array.isArray(inventory)) return null;
  const selected = new Set(Array.isArray(deck) ? deck : []);
  return inventory.find(instance => instance.cardId === cardId && !selected.has(instance.instanceId)) || null;
}

function canAddCardInstanceToDeck(instanceId, deck, inventory) {
  if (!Array.isArray(deck) || deck.length >= DECK_MAX_SIZE) return false;
  const instance = getInventoryInstance(inventory, instanceId);
  if (!instance) return false;
  return !deck.includes(instance.instanceId);
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
        cardId = isValidCardId(entry) ? migrateCardId(entry) : null;
      }
    } else {
      cardId = isValidCardId(entry) ? migrateCardId(entry) : null;
    }

    if (!isValidCardId(cardId)) {
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

function canAddCardToDeck(cardId, deck, ownedOrInventory) {
  const inventory = Array.isArray(ownedOrInventory) ? normalizeInventory(ownedOrInventory) : null;
  if (inventory) {
    const instance = getInventoryInstance(inventory, cardId);
    if (instance) return canAddCardInstanceToDeck(instance.instanceId, deck, inventory);
    if (!isValidCardId(cardId)) return false;
    return !!findAvailableInventoryInstance(cardId, deck, inventory) && deck.length < DECK_MAX_SIZE;
  }

  const ownedCards = ownedOrInventory || {};
  if (!isValidCardId(cardId)) return false;
  if (deck.length >= DECK_MAX_SIZE) return false;

  const currentCount = deck.filter(id => id === cardId).length;
  const owned = ownedCards[cardId] || 0;
  if (currentCount >= owned) return false;

  return true;
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

function grantCard(player, cardId) {
  if (!isValidCardId(cardId)) return false;
  normalizePlayerInventory(player);
  player.inventory.push(createCardInstance(cardId));
  player.ownedCards = inventoryToOwnedCards(player.inventory);
  return true;
}

function resolveDeckEntry(entry, inventory) {
  const instance = getInventoryInstance(inventory, entry);
  if (instance) {
    return { cardId: instance.cardId, grind: instance.grind || 0, instanceId: instance.instanceId };
  }
  if (isValidCardId(entry)) {
    return { cardId: migrateCardId(entry), grind: 0, instanceId: null };
  }
  return null;
}

module.exports = {
  STARTING_DECK_IDS,
  createCardInstance,
  createInventoryFromCardIds,
  createInventoryFromOwnedCards,
  normalizeInventory,
  inventoryToOwnedCards,
  getInventoryInstance,
  normalizeSelectedDeck,
  normalizePlayerInventory,
  cardIdForDeckEntry,
  findAvailableInventoryInstance,
  canAddCardInstanceToDeck,
  canAddCardToDeck,
  validateDeck,
  createPlayerProgress,
  grantCard,
  resolveDeckEntry,
};
