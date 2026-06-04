const { DECK_MAX_SIZE } = require('../config');
const { findUserByAccountId, unlockHat: unlockHatForAccount } = require('../users');
const { backfillUnlockedHats } = require('../cosmetic');
const {
  CARD_DEFS,
  normalizePlayerInventory,
  getInventoryInstance,
  cardIdForDeckEntry,
  findAvailableInventoryInstance,
  canAddCardInstanceToDeck,
  evolveCard,
  sellCard,
  grindCard,
  unlockHatForPlayer,
} = require('../progression');

function register(socket, ctx) {
  const { withLobbyFromSocket, savePlayerData } = ctx;

  socket.on('deckAddCard', (data) => {
    withLobbyFromSocket(socket, (state) => {
      if (state.gamePhase !== 'lobby') return;

      const player = state.players[socket.playerId];
      if (!player) return;
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

      player.selectedDeck.push(instance.instanceId);

      socket.emit('deckUpdate', {
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
      });

      savePlayerData(socket.playerId);
    });
  });

  socket.on('deckRemoveCard', (data) => {
    withLobbyFromSocket(socket, (state) => {
      if (state.gamePhase !== 'lobby') return;

      const player = state.players[socket.playerId];
      if (!player) return;
      normalizePlayerInventory(player);

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

      player.selectedDeck.splice(idx, 1);

      socket.emit('deckUpdate', {
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
      });

      savePlayerData(socket.playerId);
    });
  });

  socket.on('evolveCard', (data) => {
    withLobbyFromSocket(socket, (state) => {
      if (state.gamePhase !== 'lobby') return;

      const player = state.players[socket.playerId];
      if (!player) return;

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
        ownedCards: player.ownedCards,
      });
      socket.emit('deckUpdate', {
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
      });
      savePlayerData(socket.playerId);
    });
  });

  socket.on('sellCard', (data) => {
    withLobbyFromSocket(socket, (state) => {
      if (state.gamePhase !== 'lobby') return;

      const player = state.players[socket.playerId];
      if (!player) return;

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
        selectedDeck: player.selectedDeck,
      });
      savePlayerData(socket.playerId);
    });
  });

  socket.on('unlockHat', (data) => {
    withLobbyFromSocket(socket, (state) => {
      if (state.gamePhase !== 'lobby') return;

      const player = state.players[socket.playerId];
      if (!player) return;

      const hatId = data && typeof data.hatId === 'string' ? data.hatId : null;
      if (!hatId) {
        socket.emit('hatError', { reason: 'Missing hatId' });
        return;
      }

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

      const result = unlockHatForPlayer(player, hatId);
      if (!result.ok) {
        socket.emit('hatError', { reason: result.reason });
        return;
      }

      const unlockResult = unlockHatForAccount(player.accountId, hatId);
      if (!unlockResult.ok) {
        player.currency += result.cost;
        socket.emit('hatError', { reason: unlockResult.reason });
        return;
      }

      socket.emit('hatUnlocked', {
        unlockedHats: unlockResult.unlockedHats,
        currency: player.currency,
      });
      savePlayerData(socket.playerId);
    });
  });

  socket.on('grindCard', (data) => {
    withLobbyFromSocket(socket, (state) => {
      if (state.gamePhase !== 'lobby') return;

      const player = state.players[socket.playerId];
      if (!player) return;

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
        currency: player.currency,
      });
      socket.emit('deckUpdate', {
        selectedDeck: player.selectedDeck,
        inventory: player.inventory,
        ownedCards: player.ownedCards,
        currency: player.currency,
      });
      savePlayerData(socket.playerId);
    });
  });
}

module.exports = { register };
