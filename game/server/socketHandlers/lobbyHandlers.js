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
// Quest / ready / key item / medic / trade (sub-ticket 04):
//   isValidQuestId, assignRunSpawnPositions, buildQuestUpdatePayload, stateSnapshot,
//   broadcastLobbyUpdate, checkAllReady, isLobbyPhase, validateDeck, getKeyItemDef,
//   healAtMedic, offerCardTrade, respondCardTrade, findSocketByPlayerId
//
// Run / playing phase (sub-ticket 05):
//   isPlayingPhase, cardEffects, keyItemEffects, discardCardFromHand, giveUpRun,
//   returnPlayersToLobby, abandonSuspendedRun, claimCardReward, LOOT_PICKUP_RADIUS,
//   addMagicStones, recordCrystalCollected, checkRunTerminalState
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

function registerSelectQuest(socket, ctx) {
  socket.on('selectQuest', (data) => {
    ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, _player) => {
      if (state.suspendedCheckpoint) {
        socket.emit('questError', { reason: 'Abandon the suspended expedition before changing quests' });
        return;
      }

      const questId = data && typeof data.questId === 'string' ? data.questId : null;
      if (!questId) {
        socket.emit('questError', { reason: 'Missing questId' });
        return;
      }

      if (!ctx.isValidQuestId(questId)) {
        socket.emit('questError', { reason: `Unknown quest: ${questId}` });
        return;
      }

      state.selectedQuestId = questId;
      ctx.applyLayoutForQuest(state, questId);
      ctx.assignRunSpawnPositions(Object.values(state.players));
      const payload = {
        ...ctx.buildQuestUpdatePayload(state),
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      };
      ctx.io.to(lobby.id).emit('questUpdate', payload);
      ctx.io.to(lobby.id).emit('stateUpdate', ctx.stateSnapshot());
      ctx.broadcastLobbyUpdate(lobby);
    });
  });
}

function registerPlayerReady(socket, ctx) {
  socket.on('playerReady', (ready) => {
    ctx.withLobbyPlayer(socket, {}, (state, lobby, player) => {
      if (ready) {
        ctx.normalizePlayerInventory(player);
        const result = ctx.validateDeck(player.selectedDeck, player.inventory);
        if (!result.valid) {
          player.ready = false;
          socket.emit('deckError', { reason: result.reason });
          ctx.broadcastLobbyUpdate(lobby);
          return;
        }
      }

      player.ready = !!ready;
      ctx.broadcastLobbyUpdate(lobby);
      if (ctx.isLobbyPhase(state)) {
        ctx.checkAllReady();
      }
    });
  });
}

function registerEquipKeyItem(socket, ctx) {
  socket.on('equipKeyItem', (data) => {
    ctx.withLobbyPlayer(socket, {
      requirePhase: 'lobby',
      phaseMismatch: { event: 'keyItemError', payload: { reason: 'not_in_lobby' } },
    }, (state, lobby, player) => {
      const keyItemId = data && typeof data.keyItemId === 'string' ? data.keyItemId : null;
      if (!keyItemId) {
        socket.emit('keyItemError', { reason: 'missing_key_item_id' });
        return;
      }

      const def = ctx.getKeyItemDef(keyItemId);
      if (!def) {
        socket.emit('keyItemError', { reason: 'unknown_item' });
        return;
      }

      player.equippedKeyItemId = keyItemId;
      ctx.savePlayerData(socket.playerId);

      socket.emit('keyItemEquipped', { keyItemId });
    });
  });
}

function registerMedicHeal(socket, ctx) {
  socket.on('medicHeal', () => {
    ctx.withLobbyPlayer(socket, {
      requirePhase: 'lobby',
      phaseMismatch: { event: 'medicError', payload: { reason: 'not_in_lobby' } },
    }, (state, lobby, player) => {
      const result = ctx.healAtMedic(socket.playerId);
      if (!result.ok) {
        socket.emit('medicError', { reason: result.reason });
        return;
      }

      socket.emit('medicHealed', {
        hp: result.hp,
        currency: player.currency,
        cost: result.cost,
      });
      ctx.io.to(state._lobbyId).emit('stateUpdate', ctx.stateSnapshot());
    });
  });
}

function registerOfferCardTrade(socket, ctx) {
  socket.on('offerCardTrade', (data) => {
    ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
      if (!data) return;

      const targetPlayerId = typeof data.targetPlayerId === 'string' ? data.targetPlayerId : null;
      const offeredCardId = typeof data.offeredCardId === 'string' ? data.offeredCardId : null;
      const requestedCardId = typeof data.requestedCardId === 'string' ? data.requestedCardId : null;
      if (!targetPlayerId || !offeredCardId || !requestedCardId) {
        socket.emit('deckError', { reason: 'Invalid trade offer' });
        return;
      }

      const result = ctx.offerCardTrade(
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

      const targetSocket = ctx.findSocketByPlayerId(targetPlayerId);
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
}

function registerRespondCardTrade(socket, ctx) {
  socket.on('respondCardTrade', (data) => {
    ctx.withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
      if (!data) return;

      const tradeId = typeof data.tradeId === 'string' ? data.tradeId : null;
      const accepted = !!data.accepted;
      if (!tradeId) {
        socket.emit('deckError', { reason: 'Missing tradeId' });
        return;
      }

      const trade = state.pendingTrades[tradeId];
      const offererId = trade ? trade.fromPlayerId : null;
      const result = ctx.respondCardTrade(state.pendingTrades, socket.playerId, tradeId, accepted);
      if (!result.ok) {
        socket.emit('deckError', { reason: result.reason });
        return;
      }

      const notifyTradeResolved = (playerId, payload) => {
        const targetSocket = ctx.findSocketByPlayerId(playerId);
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

      const offererSocket = ctx.findSocketByPlayerId(result.offererId);
      if (offererSocket) {
        offererSocket.emit('cardInventoryUpdate', inventoryPayload(offerer));
      }
      const responderSocket = ctx.findSocketByPlayerId(result.responderId);
      if (responderSocket) {
        responderSocket.emit('cardInventoryUpdate', inventoryPayload(responder));
      }

      ctx.savePlayerData(result.offererId);
      ctx.savePlayerData(result.responderId);
    });
  });
}

function registerMove(socket, ctx) {
  socket.on('move', (data) => {
    ctx.withLobbyFromSocket(socket, (state) => {
      if (!ctx.isPlayingPhase(state)) return;

      const player = state.players[socket.playerId];

      if (!player) return;
      if (player.dead) return;
      if (player.extracted) return;
      if (player.connected === false) return;

      if (!data || typeof data !== 'object' || Array.isArray(data) ||
          !Number.isFinite(data.dx) || !Number.isFinite(data.dz) || !Number.isFinite(data.rotation)) {
        console.warn(`Rejected move from ${socket.id}: invalid payload`);
        return;
      }

      if (data.sequence !== undefined) {
        if (!Number.isInteger(data.sequence) || data.sequence <= 0) {
          console.warn(`Rejected move from ${socket.id}: invalid sequence`);
          return;
        }
        const lastSeq = player.lastInputSequence || 0;
        if (data.sequence <= lastSeq) {
          return;
        }
        player.lastInputSequence = data.sequence;
      }

      const mag = Math.hypot(data.dx, data.dz);
      if (mag > 1) { data.dx /= mag; data.dz /= mag; }

      if (player) {
        player.inputDx = data.dx;
        player.inputDz = data.dz;
        if (Number.isFinite(data.rotation)) {
          player.inputRotation = data.rotation;
          player.rotation = data.rotation;
        }
        player.inputActive = mag > 1e-8;
        player.lastInputTime = Date.now();
        player.lastActivity = Date.now();
        player.persistenceDirty = true;
      }
    });
  });
}

function registerUseCard(socket, ctx) {
  socket.on('useCard', (data) => {
    ctx.withLobbyFromSocket(socket, (state, lobby) => {
      ctx.cardEffects.handleUseCard(socket, state, lobby, data);
    });
  });
}

function registerDiscardCard(socket, ctx) {
  socket.on('discardCard', (data) => {
    ctx.withLobbyFromSocket(socket, (state, lobby) => {
      if (!ctx.isPlayingPhase(state)) return;
      if (!state.run || state.run.status !== 'playing') return;
      if (!data || typeof data.slotIndex !== 'number' || !data.cardId) return;

      const player = state.players[socket.playerId];
      if (!player || player.dead) return;

      const result = ctx.discardCardFromHand(player, data.slotIndex, data.cardId);
      if (!result.valid) {
        socket.emit('cardError', { reason: result.reason });
        return;
      }

      ctx.io.to(lobby.id).emit('stateUpdate', ctx.stateSnapshot());
    });
  });
}

function registerReturnToLobby(socket, ctx) {
  socket.on('returnToLobby', () => {
    ctx.withLobbyFromSocket(socket, (state) => {
      if (state.run && state.run.status === 'playing') {
        socket.emit('runError', { reason: 'Run still in progress' });
        return;
      }

      if (!state.run) return;

      ctx.returnPlayersToLobby();
    });
  });
}

function registerGiveUp(socket, ctx) {
  socket.on('giveUp', () => {
    ctx.withLobbyFromSocket(socket, (state) => {
      try {
        if (!ctx.isPlayingPhase(state) || !state.run || state.run.status === 'suspended') {
          socket.emit('runError', { reason: 'No active run' });
          return;
        }
        const result = ctx.giveUpRun();
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
}

function registerAbandonRun(socket, ctx) {
  socket.on('abandonRun', () => {
    ctx.withLobbyFromSocket(socket, (state) => {
      if (!state.suspendedCheckpoint) {
        socket.emit('runError', { reason: 'No suspended expedition' });
        return;
      }
      ctx.abandonSuspendedRun();
    });
  });
}

function registerClaimCardReward(socket, ctx) {
  socket.on('claimCardReward', (data) => {
    ctx.withLobbyFromSocket(socket, (state) => {
      const player = state.players[socket.playerId];
      if (!player) return;
      if (!state.run || state.run.status === 'playing') return;
      if (!data || typeof data.cardId !== 'string') return;

      const result = ctx.claimCardReward(socket.playerId, data.cardId);
      if (!result.ok) return;

      ctx.savePlayerData(socket.playerId);
      socket.emit('cardRewardClaimed', {
        cardId: result.cardId,
        ownedCards: result.ownedCards,
        inventory: result.inventory,
      });
    });
  });
}

function registerUseKeyItem(socket, ctx) {
  socket.on('useKeyItem', (data) => {
    ctx.withLobbyFromSocket(socket, (state, lobby) => {
      ctx.keyItemEffects.handleUseKeyItem(socket, state, lobby, data);
    });
  });
}

function registerLootPickup(socket, ctx) {
  socket.on('lootPickup', (data) => {
    ctx.withLobbyFromSocket(socket, (state, lobby) => {
      if (!data || !data.lootId) return;

      const player = state.players[socket.playerId];
      if (!player) return;
      if (player.dead || player.extracted) return;

      const lootIdx = state.loot.findIndex(l => l.id === data.lootId);
      if (lootIdx === -1) return;

      const loot = state.loot[lootIdx];
      const dist = Math.hypot(player.x - loot.x, player.z - loot.z);

      if (dist > ctx.LOOT_PICKUP_RADIUS) return;

      const isCrystal = loot.kind === 'crystal';
      const isMagicStone = loot.kind === 'magic_stone';
      if (isMagicStone) {
        ctx.addMagicStones(player, loot.value);
      } else if (isCrystal) {
        ctx.recordCrystalCollected(1);
      } else {
        player.currency += loot.value;
        player.currencyEarnedThisRun += loot.value;
      }
      state.loot.splice(lootIdx, 1);

      const lootLabel = isCrystal ? ' (crystal)' : isMagicStone ? ' (magic stone)' : '';
      console.log(`[loot] picked up id=${loot.id}${lootLabel} value=${loot.value} by ${socket.id} (currency=${player.currency}, ms=${player.magicStones})`);

      ctx.savePlayerData(socket.playerId);

      if (isCrystal) {
        ctx.checkRunTerminalState();
      }
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
  registerSelectQuest(socket, ctx);
  registerPlayerReady(socket, ctx);
  registerEquipKeyItem(socket, ctx);
  registerMedicHeal(socket, ctx);
  registerOfferCardTrade(socket, ctx);
  registerRespondCardTrade(socket, ctx);
  registerMove(socket, ctx);
  registerUseCard(socket, ctx);
  registerDiscardCard(socket, ctx);
  registerReturnToLobby(socket, ctx);
  registerGiveUp(socket, ctx);
  registerAbandonRun(socket, ctx);
  registerClaimCardReward(socket, ctx);
  registerUseKeyItem(socket, ctx);
  registerLootPickup(socket, ctx);
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
  registerSelectQuest,
  registerPlayerReady,
  registerEquipKeyItem,
  registerMedicHeal,
  registerOfferCardTrade,
  registerRespondCardTrade,
  registerMove,
  registerUseCard,
  registerDiscardCard,
  registerReturnToLobby,
  registerGiveUp,
  registerAbandonRun,
  registerClaimCardReward,
  registerUseKeyItem,
  registerLootPickup,
};
