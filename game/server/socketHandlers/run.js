const { LOOT_PICKUP_RADIUS } = require('../config');
const { isValidQuestId, buildQuestUpdatePayload } = require('../quests');
const cardEffects = require('../cardEffects');
const {
  discardCardFromHand,
  stateSnapshot,
  checkAllReady,
  returnPlayersToLobby,
  giveUpRun,
  abandonSuspendedRun,
  claimCardReward,
  healAtMedic,
  addMagicStones,
  recordCrystalCollected,
  checkRunTerminalState,
  assignRunSpawnPositions,
  validateDeck,
  normalizePlayerInventory,
} = require('../progression');

function register(socket, ctx) {
  const {
    withLobbyFromSocket,
    broadcastLobbyUpdate,
    savePlayerData,
    io,
    applyLayoutForQuest,
  } = ctx;

  socket.on('move', (data) => {
    withLobbyFromSocket(socket, (state) => {
      if (state.gamePhase !== 'playing') return;

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

      // Normalize input vector to unit length (defensive against oversized dx/dz)
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
        // Batched once per tick via flushDirtyPlayerSaves after applyPlayerMovement.
        player.persistenceDirty = true;
      }
    });
  });

  socket.on('useCard', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
      cardEffects.handleUseCard(socket, state, lobby, data);
    });
  });

  socket.on('discardCard', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
      if (state.gamePhase !== 'playing') return;
      if (!state.run || state.run.status !== 'playing') return;
      if (!data || typeof data.slotIndex !== 'number' || !data.cardId) return;

      const player = state.players[socket.playerId];
      if (!player || player.dead) return;

      const result = discardCardFromHand(player, data.slotIndex, data.cardId);
      if (!result.valid) {
        socket.emit('cardError', { reason: result.reason });
        return;
      }

      io.to(lobby.id).emit('stateUpdate', stateSnapshot());
    });
  });

  socket.on('selectQuest', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
      if (state.gamePhase !== 'lobby') return;

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
    withLobbyFromSocket(socket, (state, lobby) => {
      const player = state.players[socket.playerId];
      if (!player) return;

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
      if (state.gamePhase === 'lobby') {
        checkAllReady();
      }
    });
  });

  socket.on('returnToLobby', () => {
    withLobbyFromSocket(socket, (state) => {
      if (state.run && state.run.status === 'playing') {
        socket.emit('runError', { reason: 'Run still in progress' });
        return;
      }

      if (!state.run) return;

      returnPlayersToLobby();
    });
  });

  socket.on('giveUp', () => {
    withLobbyFromSocket(socket, (state) => {
      try {
        if (state.gamePhase !== 'playing' || !state.run || state.run.status === 'suspended') {
          socket.emit('runError', { reason: 'No active run' });
          return;
        }
        const result = giveUpRun();
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
      abandonSuspendedRun();
    });
  });

  socket.on('claimCardReward', (data) => {
    withLobbyFromSocket(socket, (state) => {
      const player = state.players[socket.playerId];
      if (!player) return;
      if (!state.run || state.run.status === 'playing') return;
      if (!data || typeof data.cardId !== 'string') return;

      const result = claimCardReward(socket.playerId, data.cardId);
      if (!result.ok) return;

      savePlayerData(socket.playerId);
      socket.emit('cardRewardClaimed', {
        cardId: result.cardId,
        ownedCards: result.ownedCards,
        inventory: result.inventory,
      });
    });
  });

  socket.on('medicHeal', () => {
    withLobbyFromSocket(socket, (state) => {
      if (state.gamePhase !== 'lobby') {
        socket.emit('medicError', { reason: 'not_in_lobby' });
        return;
      }

      const result = healAtMedic(socket.playerId);
      if (!result.ok) {
        socket.emit('medicError', { reason: result.reason });
        return;
      }

      const player = state.players[socket.playerId];
      socket.emit('medicHealed', {
        hp: result.hp,
        currency: player.currency,
        cost: result.cost,
      });
      io.to(state._lobbyId).emit('stateUpdate', stateSnapshot());
    });
  });

  socket.on('lootPickup', (data) => {
    withLobbyFromSocket(socket, (state, lobby) => {
      if (!data || !data.lootId) return;

      const player = state.players[socket.playerId];
      if (!player) return;
      if (player.dead || player.extracted) return;

      const lootIdx = state.loot.findIndex(l => l.id === data.lootId);
      if (lootIdx === -1) return;

      const loot = state.loot[lootIdx];
      const dist = Math.hypot(player.x - loot.x, player.z - loot.z);

      if (dist > LOOT_PICKUP_RADIUS) return;

      const isCrystal = loot.kind === 'crystal';
      const isMagicStone = loot.kind === 'magic_stone';
      if (isMagicStone) {
        addMagicStones(player, loot.value);
      } else if (isCrystal) {
        recordCrystalCollected(1);
      } else {
        player.currency += loot.value;
        player.currencyEarnedThisRun += loot.value;
      }
      state.loot.splice(lootIdx, 1);

      const lootLabel = isCrystal ? ' (crystal)' : isMagicStone ? ' (magic stone)' : '';
      console.log(`[loot] picked up id=${loot.id}${lootLabel} value=${loot.value} by ${socket.id} (currency=${player.currency}, ms=${player.magicStones})`);

      savePlayerData(socket.playerId);

      if (isCrystal) {
        checkRunTerminalState();
      }
    });
  });
}

module.exports = { register };
