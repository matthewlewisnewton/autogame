// ── Deck Socket Handlers ──
// Registers deck edit socket.on handlers extracted from lobbyHandlers.js.

const { DECK_MAX_SIZE } = require('../config');
const {
  CARD_DEFS,
  normalizePlayerInventory,
  getInventoryInstance,
  cardIdForDeckEntry,
  findAvailableInventoryInstance,
  canAddCardInstanceToDeck,
  savePlayerData,
} = require('../progression');

function register(socket, ctx) {
  const { withLobbyPlayer } = ctx;

  socket.on('deckAddCard', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    normalizePlayerInventory(player);

    const requestedInstanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const requestedCardId = data && typeof data.cardId === 'string' ? data.cardId : null;
    if (!requestedInstanceId && !requestedCardId) {
      socket.emit('deckError', { reason: 'Missing cardId' });
      return;
    }

    let instance = null;
    if (requestedInstanceId) {
      instance = getInventoryInstance(player.inventory, requestedInstanceId);
      if (!instance) {
        socket.emit('deckError', { reason: `Unknown card instance: ${requestedInstanceId}` });
        return;
      }
    } else {
      if (!CARD_DEFS[requestedCardId]) {
        socket.emit('deckError', { reason: `Unknown card: ${requestedCardId}` });
        return;
      }
      instance = findAvailableInventoryInstance(requestedCardId, player.selectedDeck, player.inventory);
    }

    const cardId = instance ? instance.cardId : requestedCardId;
    if (!instance) {
      socket.emit('deckError', { reason: `No extra copies of ${cardId} to add` });
      return;
    }

    // Validate deck rules via the selected instance.
    if (!canAddCardInstanceToDeck(instance.instanceId, player.selectedDeck, player.inventory)) {
      if (player.selectedDeck.length >= DECK_MAX_SIZE) {
        socket.emit('deckError', { reason: `Deck is full (${DECK_MAX_SIZE} cards max)` });
      } else if (!findAvailableInventoryInstance(cardId, player.selectedDeck, player.inventory)) {
        socket.emit('deckError', { reason: `No extra copies of ${cardId} to add` });
      } else {
        socket.emit('deckError', { reason: `Cannot add ${cardId} to deck` });
      }
      return;
    }

    // Add this specific card instance to the deck.
    player.selectedDeck.push(instance.instanceId);

    // Emit deckUpdate to the requesting player only
    socket.emit('deckUpdate', {
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards
    });

    savePlayerData(socket.playerId);
    });
  });

  socket.on('deckRemoveCard', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    normalizePlayerInventory(player);

    const requestedInstanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const requestedCardId = data && typeof data.cardId === 'string' ? data.cardId : null;
    if (!requestedInstanceId && !requestedCardId) {
      socket.emit('deckError', { reason: 'Missing cardId' });
      return;
    }

    // Find the selected instance in the deck. Legacy cardId payloads remove
    // the first matching card instance for backward compatibility.
    let idx = -1;
    let cardId = requestedCardId;
    if (requestedInstanceId) {
      idx = player.selectedDeck.indexOf(requestedInstanceId);
      cardId = cardIdForDeckEntry(requestedInstanceId, player.inventory) || requestedInstanceId;
    } else {
      idx = player.selectedDeck.findIndex(entry =>
        cardIdForDeckEntry(entry, player.inventory) === requestedCardId
      );
    }
    if (idx === -1) {
      socket.emit('deckError', { reason: `Card ${cardId} not in deck` });
      return;
    }

    // Remove one occurrence
    player.selectedDeck.splice(idx, 1);

    // Emit deckUpdate to the requesting player only
    socket.emit('deckUpdate', {
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards
    });

    savePlayerData(socket.playerId);
    });
  });
}

module.exports = { register };
