// ── Deck Socket Handlers ──
// Registers deck edit socket.on handlers extracted from lobbyHandlers.js.

const { DECK_MAX_SIZE } = require('../config');
const { DEFAULT_QUEST_TIER } = require('../quests');
const { isLobbyPhase } = require('../lobbies');
const { isQuestTierUnlocked } = require('../users');
const {
  CARD_DEFS,
  normalizePlayerInventory,
  getInventoryInstance,
  cardIdForDeckEntry,
  findAvailableInventoryInstance,
  canAddCardInstanceToDeck,
  validateDeck,
  checkAllReady,
  evolveCard,
  grindCard,
  sellCard,
  buyShopCard,
  offerCardTrade,
  respondCardTrade,
  savePlayerData,
} = require('../progression');

function register(socket, ctx) {
  const { withLobbyPlayer, broadcastLobbyUpdate, findSocketByPlayerId } = ctx;

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

  socket.on('buyShopCard', () => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    const result = buyShopCard(player, state.shopOffer);
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

  socket.on('offerCardTrade', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    if (!data) return;

    const targetPlayerId = typeof data.targetPlayerId === 'string' ? data.targetPlayerId : null;
    const offeredCardId = typeof data.offeredCardId === 'string' ? data.offeredCardId : null;
    const requestedCardId = typeof data.requestedCardId === 'string' ? data.requestedCardId : null;
    if (!targetPlayerId || !offeredCardId || !requestedCardId) {
      socket.emit('deckError', { reason: 'Invalid trade offer' });
      return;
    }

    const result = offerCardTrade(
      state.pendingTrades,
      socket.playerId,
      targetPlayerId,
      offeredCardId,
      requestedCardId
    );
    if (!result.ok) {
      socket.emit('deckError', { reason: result.reason });
      return;
    }

    socket.emit('tradeUpdate', {
      tradeId: result.tradeId,
      status: 'offered',
      targetPlayerId,
      offeredCardId,
      requestedCardId
    });

    const targetSocket = findSocketByPlayerId(targetPlayerId);
    if (targetSocket) {
      targetSocket.emit('tradeOffer', {
        tradeId: result.tradeId,
        fromPlayerId: socket.playerId,
        fromUsername: player.username || socket.playerId,
        offeredCardId,
        requestedCardId
      });
    }
    });
  });

  socket.on('respondCardTrade', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    if (!data) return;

    const tradeId = typeof data.tradeId === 'string' ? data.tradeId : null;
    const accepted = !!data.accepted;
    if (!tradeId) {
      socket.emit('deckError', { reason: 'Missing tradeId' });
      return;
    }

    const trade = state.pendingTrades[tradeId];
    const offererId = trade ? trade.fromPlayerId : null;
    const result = respondCardTrade(state.pendingTrades, socket.playerId, tradeId, accepted);
    if (!result.ok) {
      socket.emit('deckError', { reason: result.reason });
      return;
    }

    const notifyTradeResolved = (playerId, payload) => {
      const targetSocket = findSocketByPlayerId(playerId);
      if (targetSocket) targetSocket.emit('tradeUpdate', payload);
    };

    if (!result.accepted) {
      notifyTradeResolved(socket.playerId, { tradeId, status: 'rejected' });
      if (offererId) {
        notifyTradeResolved(offererId, { tradeId, status: 'rejected' });
      }
      return;
    }

    const offerer = state.players[result.offererId];
    const responder = state.players[result.responderId];
    const inventoryPayload = (p) => ({
      inventory: p.inventory,
      ownedCards: p.ownedCards,
      currency: p.currency,
      selectedDeck: p.selectedDeck
    });

    notifyTradeResolved(result.offererId, { tradeId, status: 'accepted' });
    notifyTradeResolved(result.responderId, { tradeId, status: 'accepted' });

    const offererSocket = findSocketByPlayerId(result.offererId);
    if (offererSocket) {
      offererSocket.emit('cardInventoryUpdate', inventoryPayload(offerer));
    }
    const responderSocket = findSocketByPlayerId(result.responderId);
    if (responderSocket) {
      responderSocket.emit('cardInventoryUpdate', inventoryPayload(responder));
    }

    savePlayerData(result.offererId);
    savePlayerData(result.responderId);
    });
  });

  socket.on('playerReady', (ready) => {
    withLobbyPlayer(socket, {}, (state, lobby, player) => {
    if (ready) {
      const selectedTier = state.selectedQuestTier ?? DEFAULT_QUEST_TIER;
      if (selectedTier >= 2) {
        const questId = state.selectedQuestId;
        if (!isQuestTierUnlocked(player.accountId, questId, selectedTier)) {
          player.ready = false;
          socket.emit('questError', { reason: 'tier_locked' });
          broadcastLobbyUpdate(lobby);
          return;
        }
      }

      normalizePlayerInventory(player);
      const result = validateDeck(player.selectedDeck, player.inventory);
      if (!result.valid) {
        player.ready = false;
        socket.emit('deckError', { reason: result.reason });
        broadcastLobbyUpdate(lobby);
        return;
      }
    }

    player.ready = !!ready;
    broadcastLobbyUpdate(lobby);
    if (isLobbyPhase(state)) {
      checkAllReady();
    }
    });
  });
}

module.exports = { register };
