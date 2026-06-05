const { DECK_MAX_SIZE } = require('../config');
const { findUserByAccountId, unlockHat: unlockHatForAccount } = require('../users');
const { backfillUnlockedHats } = require('../cosmetic');
const {
  CARD_DEFS,
  normalizePlayerInventory,
  getInventoryInstance,
  findAvailableInventoryInstance,
  canAddCardInstanceToDeck,
  cardIdForDeckEntry,
  evolveCard,
  sellCard,
  grindCard,
  unlockHatForPlayer,
  healAtMedic,
  stateSnapshot,
} = require('../progression');

/**
 * Lobby-phase deck, sell, grind, hat unlock, and medic handlers.
 */
function register(socket, ctx) {
  const { savePlayerData, withLobbyPlayer, io } = ctx;

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

  socket.on('evolveCard', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    const instanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const result = evolveCard(player, instanceId);
    if (!result.ok) {
      socket.emit('cardEvolutionError', { reason: result.reason });
      return;
    }

    socket.emit('cardEvolutionResult', {
      ...result,
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards
    });
    socket.emit('deckUpdate', {
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards
    });
    savePlayerData(socket.playerId);
    });
  });

  socket.on('sellCard', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    const requestedInstanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const requestedCardId = data && typeof data.cardId === 'string' ? data.cardId : null;
    if (!requestedInstanceId && !requestedCardId) {
      socket.emit('deckError', { reason: 'Missing cardId' });
      return;
    }

    let cardId = requestedCardId;
    if (requestedInstanceId) {
      const instance = getInventoryInstance(player.inventory, requestedInstanceId);
      cardId = instance ? instance.cardId : requestedCardId;
    }

    const result = sellCard(player, cardId, requestedInstanceId);
    if (!result.ok) {
      socket.emit('deckError', { reason: result.reason });
      return;
    }

    socket.emit('cardInventoryUpdate', {
      inventory: player.inventory,
      ownedCards: player.ownedCards,
      currency: player.currency,
      selectedDeck: player.selectedDeck
    });
    savePlayerData(socket.playerId);
    });
  });

  socket.on('unlockHat', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    const hatId = data && typeof data.hatId === 'string' ? data.hatId : null;
    if (!hatId) {
      socket.emit('hatError', { reason: 'Missing hatId' });
      return;
    }

    // Reject early if the account already owns the hat — no currency change.
    const account = findUserByAccountId(player.accountId);
    if (!account) {
      socket.emit('hatError', { reason: 'Account not found' });
      return;
    }
    const owned = backfillUnlockedHats(account.unlockedHats);
    if (owned.includes(hatId)) {
      socket.emit('hatError', { reason: 'Hat already unlocked' });
      return;
    }

    // Deduct currency (validates the hat exists and affordability).
    const result = unlockHatForPlayer(player, hatId);
    if (!result.ok) {
      socket.emit('hatError', { reason: result.reason });
      return;
    }

    // Persist deducted currency before recording the hat on the account.
    // Safe ordering: currency first, hat second — a crash after this save but
    // before unlock leaves charged-but-not-unlocked (retryable via unlockHat)
    // instead of unlocked-but-not-charged (free-hat exploit).
    const saved = savePlayerData(socket.playerId);
    if (!saved) {
      player.currency += result.cost;
      socket.emit('hatError', { reason: 'Failed to save progress' });
      return;
    }

    const unlockResult = unlockHatForAccount(player.accountId, hatId);
    if (!unlockResult.ok) {
      // Refund in memory and re-save so disk matches RAM; otherwise the first
      // save would leave deducted currency on disk without a hat unlock.
      player.currency += result.cost;
      savePlayerData(socket.playerId);
      socket.emit('hatError', { reason: unlockResult.reason });
      return;
    }

    socket.emit('hatUnlocked', {
      unlockedHats: unlockResult.unlockedHats,
      currency: player.currency
    });
    savePlayerData(socket.playerId);
    });
  });

  socket.on('medicHeal', () => {
    withLobbyPlayer(socket, {
      requirePhase: 'lobby',
      phaseMismatch: { event: 'medicError', payload: { reason: 'not_in_lobby' } },
    }, (state, lobby, player) => {
      const result = healAtMedic(socket.playerId);
      if (!result.ok) {
        socket.emit('medicError', { reason: result.reason });
        return;
      }

      socket.emit('medicHealed', {
        hp: result.hp,
        currency: player.currency,
        cost: result.cost,
      });
      io.to(state._lobbyId).emit('stateUpdate', stateSnapshot());
    });
  });

  socket.on('grindCard', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    const instanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
    const result = grindCard(player, instanceId);
    if (!result.ok) {
      socket.emit('cardGrindError', { reason: result.reason });
      return;
    }

    socket.emit('cardGrindResult', {
      ...result,
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards,
      currency: player.currency
    });
    socket.emit('deckUpdate', {
      selectedDeck: player.selectedDeck,
      inventory: player.inventory,
      ownedCards: player.ownedCards,
      currency: player.currency
    });
    savePlayerData(socket.playerId);
    });
  });
}

module.exports = { register };
