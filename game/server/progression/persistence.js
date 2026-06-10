// Player save/load and persistence provider wiring.

const { MAX_HP, STARTING_MAGIC_STONES } = require('../config');

let provider = null;

function setTestProvider(p) {
  provider = p;
}

function getProvider() {
  return provider;
}

const { normalizePlayerInventory, inventoryToOwnedCards } = require('./inventory');

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

function persistenceKey(state, playerId) {
  const player = state.players[playerId];
  if (!player) return playerId;
  return player.accountId || playerId;
}

function savePlayerData(state, playerId) {
  if (!provider) return true;
  const player = state.players[playerId];
  if (!player) return true;
  try {
    const key = persistenceKey(state, playerId);
    provider.savePlayer(key, extractPersistentData(player));
    return true;
  } catch (err) {
    console.error(`[persistence] savePlayerData failed for ${playerId}:`, err.message);
    return false;
  }
}

function saveAllPlayers(state) {
  for (const playerId of Object.keys(state.players)) {
    try {
      savePlayerData(state, playerId);
    } catch (err) {
      console.error(`[persistence] saveAllPlayers failed for ${playerId}:`, err.message);
    }
  }
}

module.exports = {
  setTestProvider,
  getProvider,
  extractPersistentData,
  persistenceKey,
  savePlayerData,
  saveAllPlayers,
};
