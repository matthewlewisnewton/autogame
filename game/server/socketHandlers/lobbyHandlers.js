// ── Lobby Socket Handlers ──
// Registers lobby-browser, deck/shop/trade, and run-lifecycle socket.on handlers
// that previously lived inline in the io.on('connection') closure in index.js.
//
// ── Circular-dependency resolution ──
// This module must NOT require('./index') (circular). Per-connection identity
// and index.js-local helpers are supplied via the ctx object passed to
// register(socket, ctx) from the connection handler.

const { DECK_MAX_SIZE } = require('../config');
const { isValidQuestId, buildQuestUpdatePayload } = require('../quests');
const { isLobbyPhase, isPlayingPhase } = require('../lobbies');
const { findUserByAccountId, unlockHat: unlockHatForAccount } = require('../users');
const { backfillUnlockedHats } = require('../cosmetic');
const keyItemEffects = require('../keyItemEffects');
const {
  CARD_DEFS,
  getKeyItemDef,
  normalizePlayerInventory,
  getInventoryInstance,
  cardIdForDeckEntry,
  findAvailableInventoryInstance,
  canAddCardInstanceToDeck,
  evolveCard,
  sellCard,
  buyShopCard,
  unlockHatForPlayer,
  healAtMedic,
  grindCard,
  offerCardTrade,
  respondCardTrade,
  validateDeck,
  checkAllReady,
  assignRunSpawnPositions,
  stateSnapshot,
  savePlayerData,
} = require('../progression');

function register(socket, ctx) {
  const {
    playerId,
    sessionPlayer,
    lobbies,
    getUnlockedKeyItems,
    withLobbyContext,
    applyLayoutForQuest,
    ensureShopOffer,
    joinPlayerToLobby,
    joinLobbyWithPhasePolicy,
    leaveLobbyForSocket,
    buildSessionFromPlayer,
    reconnectPlayerToLobby,
    withLobbyPlayer,
    withLobbyFromSocket,
    broadcastLobbyUpdate,
    findSocketByPlayerId,
    io,
    returnPlayersToLobby,
    giveUpRun,
    abandonSuspendedRun,
    claimCardReward,
  } = ctx;

  socket.on('listLobbies', () => {
    socket.emit('lobbyListUpdate', { lobbies: lobbies.listLobbySummaries() });
  });

  socket.on('listKeyItems', () => {
    const items = getUnlockedKeyItems().map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      cooldownMs: def.cooldownMs,
    }));
    socket.emit('keyItemsListed', { items });
  });

  socket.on('createLobby', (data) => {
    if (lobbies.getLobbyForPlayer(playerId)) {
      socket.emit('lobbyError', { reason: 'Already in a lobby' });
      return;
    }
    const lobby = lobbies.createLobby(data && data.name);
    withLobbyContext(lobby, () => {
      applyLayoutForQuest(lobby.state, lobby.state.selectedQuestId);
      ensureShopOffer();
    });
    joinPlayerToLobby(socket, lobby);
  });

  socket.on('joinLobby', (data) => {
    const existingLobby = lobbies.getLobbyForPlayer(playerId);
    if (existingLobby) {
      const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
      const player = existingLobby.state.players[playerId];
      if (player && player.connected === false && lobbyId === existingLobby.id) {
        reconnectPlayerToLobby(socket, existingLobby);
        return;
      }
      socket.emit('lobbyError', { reason: 'Already in a lobby' });
      return;
    }
    const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
    if (!lobbyId) {
      socket.emit('lobbyError', { reason: 'Missing lobbyId' });
      return;
    }
    const lobby = lobbies.getLobbyById(lobbyId);
    if (!lobby) {
      socket.emit('lobbyError', { reason: 'Lobby not found' });
      return;
    }
    joinLobbyWithPhasePolicy(socket, lobby);
  });

  socket.on('leaveLobby', () => {
    if (!lobbies.getLobbyForPlayer(playerId)) {
      socket.emit('lobbyError', { reason: 'Not in a lobby' });
      return;
    }
    leaveLobbyForSocket(socket);
    const session = lobbies.getSession(playerId) || buildSessionFromPlayer(sessionPlayer);
    lobbies.registerSession(playerId, session);
    socket.emit('lobbyLeft', {
      lobbies: lobbies.listLobbySummaries(),
    });
  });

  socket.on('selectQuest', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, _player) => {
    if (state.suspendedCheckpoint) {
      socket.emit('questError', { reason: 'Abandon the suspended expedition before changing quests' });
      return;
    }

    const questId = data && typeof data.questId === 'string' ? data.questId : null;
    if (!questId) {
      socket.emit('questError', { reason: 'Missing questId' });
      return;
    }

    if (!isValidQuestId(questId)) {
      socket.emit('questError', { reason: `Unknown quest: ${questId}` });
      return;
    }

    state.selectedQuestId = questId;
    applyLayoutForQuest(state, questId);
    assignRunSpawnPositions(Object.values(state.players));
    const payload = {
      ...buildQuestUpdatePayload(state),
      layoutSeed: state.layoutSeed,
      layout: state.layout,
    };
    io.to(lobby.id).emit('questUpdate', payload);
    io.to(lobby.id).emit('stateUpdate', stateSnapshot());
    broadcastLobbyUpdate(lobby);
    });
  });

  socket.on('playerReady', (ready) => {
    withLobbyPlayer(socket, {}, (state, lobby, player) => {
    if (ready) {
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

  socket.on('equipKeyItem', (data) => {
    withLobbyPlayer(socket, {
      requirePhase: 'lobby',
      phaseMismatch: { event: 'keyItemError', payload: { reason: 'not_in_lobby' } },
    }, (state, lobby, player) => {
    const keyItemId = data && typeof data.keyItemId === 'string' ? data.keyItemId : null;
    if (!keyItemId) {
      socket.emit('keyItemError', { reason: 'missing_key_item_id' });
      return;
    }

    const def = getKeyItemDef(keyItemId);
    if (!def) {
      socket.emit('keyItemError', { reason: 'unknown_item' });
      return;
    }

    player.equippedKeyItemId = keyItemId;
    savePlayerData(socket.playerId);

    socket.emit('keyItemEquipped', { keyItemId });
    });
  });

  socket.on('useKeyItem', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
      keyItemEffects.handleUseKeyItem(socket, state, lobby, data);
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
      const result = healAtMedic(socket.playerId, state);
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

  socket.on('returnToLobby', () => {
    withLobbyFromSocket(socket, (state) => {
    if (state.run && state.run.status === 'playing') {
      socket.emit('runError', { reason: 'Run still in progress' });
      return;
    }

    if (!state.run) return;

    returnPlayersToLobby(state);
    });
  });

  socket.on('giveUp', () => {
    withLobbyFromSocket(socket, (state) => {
      try {
        if (!isPlayingPhase(state) || !state.run || state.run.status === 'suspended') {
          socket.emit('runError', { reason: 'No active run' });
          return;
        }
        const result = giveUpRun(state);
        if (!result.ok) {
          socket.emit('runError', { reason: result.reason || 'Cannot give up' });
          return;
        }
        socket.emit('runAbandoned');
      } catch (err) {
        console.error('[giveUp] failed:', err);
        socket.emit('runError', { reason: 'Give up failed' });
      }
    });
  });

  socket.on('abandonRun', () => {
    withLobbyFromSocket(socket, (state) => {
      if (!state.suspendedCheckpoint) {
        socket.emit('runError', { reason: 'No suspended expedition' });
        return;
      }
      abandonSuspendedRun(state);
    });
  });

  socket.on('claimCardReward', (data) => {
    withLobbyFromSocket(socket, (state) => {
    const player = state.players[socket.playerId];
    if (!player) return;
    if (!state.run || state.run.status === 'playing') return;
    if (!data || typeof data.cardId !== 'string') return;

    const result = claimCardReward(socket.playerId, data.cardId, state);
    if (!result.ok) return;

    savePlayerData(socket.playerId);
    socket.emit('cardRewardClaimed', {
      cardId: result.cardId,
      ownedCards: result.ownedCards,
      inventory: result.inventory,
    });
    });
  });
}

module.exports = { register };
