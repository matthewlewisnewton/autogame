// ── Lobby Socket Handlers ──
// Per-event register*(socket, ctx) functions; wired from index.js via
// registerLobbyHandlers(socket, ctx) after the connection preamble.
//
// Expected ctx fields (connection identity):
//   playerId, accountId, username, sessionPlayer, socket, io, lobbies
//
// Index-local helpers (for current and later sub-tickets):
//   withLobbyContext, withLobbyFromSocket, withLobbyPlayer, getLobbyForSocket,
//   broadcastLobbyList, applyLayoutForQuest, ensureShopOffer, joinPlayerToLobby,
//   joinLobbyWithPhasePolicy, reconnectPlayerToLobby, leaveLobbyForSocket,
//   buildSessionFromPlayer
//
// Deck/shop progression (sub-ticket 03):
//   normalizePlayerInventory, getInventoryInstance, findAvailableInventoryInstance,
//   canAddCardInstanceToDeck, cardIdForDeckEntry, CARD_DEFS, DECK_MAX_SIZE,
//   savePlayerData, sellCard, buyShopCard, grindCard, evolveCard,
//   unlockHatForPlayer, unlockHatForAccount, findUserByAccountId, backfillUnlockedHats
//
// This module must NOT require('./index') (circular). Use ctx or leaf modules.

const { getUnlockedKeyItems } = require('../progression');

function registerListLobbies(socket, ctx) {
  socket.on('listLobbies', () => {
    socket.emit('lobbyListUpdate', { lobbies: ctx.lobbies.listLobbySummaries() });
  });
}

function registerListKeyItems(socket, ctx) {
  socket.on('listKeyItems', () => {
    const items = getUnlockedKeyItems().map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      cooldownMs: def.cooldownMs,
    }));
    socket.emit('keyItemsListed', { items });
  });
}

function registerCreateLobby(socket, ctx) {
  socket.on('createLobby', (data) => {
    if (ctx.lobbies.getLobbyForPlayer(ctx.playerId)) {
      socket.emit('lobbyError', { reason: 'Already in a lobby' });
      return;
    }
    const lobby = ctx.lobbies.createLobby(data && data.name);
    ctx.withLobbyContext(lobby, () => {
      ctx.applyLayoutForQuest(lobby.state, lobby.state.selectedQuestId);
      ctx.ensureShopOffer();
    });
    ctx.joinPlayerToLobby(socket, lobby);
  });
}

function registerJoinLobby(socket, ctx) {
  socket.on('joinLobby', (data) => {
    const existingLobby = ctx.lobbies.getLobbyForPlayer(ctx.playerId);
    if (existingLobby) {
      const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
      const player = existingLobby.state.players[ctx.playerId];
      if (player && player.connected === false && lobbyId === existingLobby.id) {
        ctx.reconnectPlayerToLobby(socket, existingLobby);
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
    const lobby = ctx.lobbies.getLobbyById(lobbyId);
    if (!lobby) {
      socket.emit('lobbyError', { reason: 'Lobby not found' });
      return;
    }
    ctx.joinLobbyWithPhasePolicy(socket, lobby);
  });
}

function registerLeaveLobby(socket, ctx) {
  socket.on('leaveLobby', () => {
    if (!ctx.lobbies.getLobbyForPlayer(ctx.playerId)) {
      socket.emit('lobbyError', { reason: 'Not in a lobby' });
      return;
    }
    ctx.leaveLobbyForSocket(socket);
    const session =
      ctx.lobbies.getSession(ctx.playerId) || ctx.buildSessionFromPlayer(ctx.sessionPlayer);
    ctx.lobbies.registerSession(ctx.playerId, session);
    socket.emit('lobbyLeft', {
      lobbies: ctx.lobbies.listLobbySummaries(),
    });
  });
}

function registerDeckAddCard(socket, ctx) {
  socket.on('deckAddCard', (data) => {
    ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
      ctx.normalizePlayerInventory(player);

      const requestedInstanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
      const requestedCardId = data && typeof data.cardId === 'string' ? data.cardId : null;
      if (!requestedInstanceId && !requestedCardId) {
        socket.emit('deckError', { reason: 'Missing cardId' });
        return;
      }

      let instance = null;
      if (requestedInstanceId) {
        instance = ctx.getInventoryInstance(player.inventory, requestedInstanceId);
        if (!instance) {
          socket.emit('deckError', { reason: `Unknown card instance: ${requestedInstanceId}` });
          return;
        }
      } else {
        if (!ctx.CARD_DEFS[requestedCardId]) {
          socket.emit('deckError', { reason: `Unknown card: ${requestedCardId}` });
          return;
        }
        instance = ctx.findAvailableInventoryInstance(requestedCardId, player.selectedDeck, player.inventory);
      }

      const cardId = instance ? instance.cardId : requestedCardId;
      if (!instance) {
        socket.emit('deckError', { reason: `No extra copies of ${cardId} to add` });
        return;
      }

      if (!ctx.canAddCardInstanceToDeck(instance.instanceId, player.selectedDeck, player.inventory)) {
        if (player.selectedDeck.length >= ctx.DECK_MAX_SIZE) {
          socket.emit('deckError', { reason: `Deck is full (${ctx.DECK_MAX_SIZE} cards max)` });
        } else if (!ctx.findAvailableInventoryInstance(cardId, player.selectedDeck, player.inventory)) {
          socket.emit('deckError', { reason: `No extra copies of ${cardId} to add` });
        } else {
          socket.emit('deckError', { reason: `Cannot add ${cardId} to deck` });
        }
        return;
      }

      player.selectedDeck.push(instance.instanceId);

      socket.emit('deckUpdate', {
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
      });

      ctx.savePlayerData(socket.playerId);
    });
  });
}

function registerDeckRemoveCard(socket, ctx) {
  socket.on('deckRemoveCard', (data) => {
    ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
      ctx.normalizePlayerInventory(player);

      const requestedInstanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
      const requestedCardId = data && typeof data.cardId === 'string' ? data.cardId : null;
      if (!requestedInstanceId && !requestedCardId) {
        socket.emit('deckError', { reason: 'Missing cardId' });
        return;
      }

      let idx = -1;
      let cardId = requestedCardId;
      if (requestedInstanceId) {
        idx = player.selectedDeck.indexOf(requestedInstanceId);
        cardId = ctx.cardIdForDeckEntry(requestedInstanceId, player.inventory) || requestedInstanceId;
      } else {
        idx = player.selectedDeck.findIndex((entry) =>
          ctx.cardIdForDeckEntry(entry, player.inventory) === requestedCardId
        );
      }
      if (idx === -1) {
        socket.emit('deckError', { reason: `Card ${cardId} not in deck` });
        return;
      }

      player.selectedDeck.splice(idx, 1);

      socket.emit('deckUpdate', {
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
      });

      ctx.savePlayerData(socket.playerId);
    });
  });
}

function registerEvolveCard(socket, ctx) {
  socket.on('evolveCard', (data) => {
    ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
      const instanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
      const result = ctx.evolveCard(player, instanceId);
      if (!result.ok) {
        socket.emit('cardEvolutionError', { reason: result.reason });
        return;
      }

      socket.emit('cardEvolutionResult', {
        ...result,
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
      });
      socket.emit('deckUpdate', {
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
      });
      ctx.savePlayerData(socket.playerId);
    });
  });
}

function registerSellCard(socket, ctx) {
  socket.on('sellCard', (data) => {
    ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
      const requestedInstanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
      const requestedCardId = data && typeof data.cardId === 'string' ? data.cardId : null;
      if (!requestedInstanceId && !requestedCardId) {
        socket.emit('deckError', { reason: 'Missing cardId' });
        return;
      }

      let cardId = requestedCardId;
      if (requestedInstanceId) {
        const instance = ctx.getInventoryInstance(player.inventory, requestedInstanceId);
        cardId = instance ? instance.cardId : requestedCardId;
      }

      const result = ctx.sellCard(player, cardId, requestedInstanceId);
      if (!result.ok) {
        socket.emit('deckError', { reason: result.reason });
        return;
      }

      socket.emit('cardInventoryUpdate', {
        inventory: player.inventory,
        ownedCards: player.ownedCards,
        currency: player.currency,
        selectedDeck: player.selectedDeck,
      });
      ctx.savePlayerData(socket.playerId);
    });
  });
}

function registerBuyShopCard(socket, ctx) {
  socket.on('buyShopCard', () => {
    ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
      const result = ctx.buyShopCard(player, state.shopOffer);
      if (!result.ok) {
        socket.emit('deckError', { reason: result.reason });
        return;
      }

      socket.emit('cardInventoryUpdate', {
        inventory: player.inventory,
        ownedCards: player.ownedCards,
        currency: player.currency,
        selectedDeck: player.selectedDeck,
      });
      ctx.savePlayerData(socket.playerId);
    });
  });
}

function registerUnlockHat(socket, ctx) {
  socket.on('unlockHat', (data) => {
    ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
      const hatId = data && typeof data.hatId === 'string' ? data.hatId : null;
      if (!hatId) {
        socket.emit('hatError', { reason: 'Missing hatId' });
        return;
      }

      const account = ctx.findUserByAccountId(player.accountId);
      if (!account) {
        socket.emit('hatError', { reason: 'Account not found' });
        return;
      }
      const owned = ctx.backfillUnlockedHats(account.unlockedHats);
      if (owned.includes(hatId)) {
        socket.emit('hatError', { reason: 'Hat already unlocked' });
        return;
      }

      const result = ctx.unlockHatForPlayer(player, hatId);
      if (!result.ok) {
        socket.emit('hatError', { reason: result.reason });
        return;
      }

      const saved = ctx.savePlayerData(socket.playerId);
      if (!saved) {
        player.currency += result.cost;
        socket.emit('hatError', { reason: 'Failed to save progress' });
        return;
      }

      const unlockResult = ctx.unlockHatForAccount(player.accountId, hatId);
      if (!unlockResult.ok) {
        player.currency += result.cost;
        ctx.savePlayerData(socket.playerId);
        socket.emit('hatError', { reason: unlockResult.reason });
        return;
      }

      socket.emit('hatUnlocked', {
        unlockedHats: unlockResult.unlockedHats,
        currency: player.currency,
      });
      ctx.savePlayerData(socket.playerId);
    });
  });
}

function registerGrindCard(socket, ctx) {
  socket.on('grindCard', (data) => {
    ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
      const instanceId = data && typeof data.instanceId === 'string' ? data.instanceId : null;
      const result = ctx.grindCard(player, instanceId);
      if (!result.ok) {
        socket.emit('cardGrindError', { reason: result.reason });
        return;
      }

      socket.emit('cardGrindResult', {
        ...result,
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
        currency: player.currency,
      });
      socket.emit('deckUpdate', {
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
        currency: player.currency,
      });
      ctx.savePlayerData(socket.playerId);
    });
  });
}

function registerLobbyHandlers(socket, ctx) {
  registerListLobbies(socket, ctx);
  registerListKeyItems(socket, ctx);
  registerCreateLobby(socket, ctx);
  registerJoinLobby(socket, ctx);
  registerLeaveLobby(socket, ctx);
  registerDeckAddCard(socket, ctx);
  registerDeckRemoveCard(socket, ctx);
  registerSellCard(socket, ctx);
  registerBuyShopCard(socket, ctx);
  registerGrindCard(socket, ctx);
  registerEvolveCard(socket, ctx);
  registerUnlockHat(socket, ctx);
}

module.exports = {
  registerLobbyHandlers,
  registerListLobbies,
  registerListKeyItems,
  registerCreateLobby,
  registerJoinLobby,
  registerLeaveLobby,
  registerDeckAddCard,
  registerDeckRemoveCard,
  registerSellCard,
  registerBuyShopCard,
  registerGrindCard,
  registerEvolveCard,
  registerUnlockHat,
};
