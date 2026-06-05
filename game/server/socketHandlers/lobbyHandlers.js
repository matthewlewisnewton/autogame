// ── Lobby Socket Handlers ──
// Registers lobby-browser, run-lifecycle, and playing-phase socket.on handlers
// that previously lived inline in the io.on('connection') closure in index.js.
// Deck/shop/inventory handlers live in deckHandlers.js.
// Trade handlers live in tradeHandlers.js.
//
// ── Circular-dependency resolution ──
// This module must NOT require('./index') (circular). Per-connection identity
// and index.js-local helpers are supplied via the ctx object passed to
// register(socket, ctx) from the connection handler.

const { LOOT_PICKUP_RADIUS, MAX_PLAYERS } = require('../config');
const deckHandlers = require('./deckHandlers');
const tradeHandlers = require('./tradeHandlers');
const {
  DEFAULT_QUEST_TIER,
  isValidQuestSelection,
  normalizeQuestTier,
} = require('../quests');
const { isPlayingPhase } = require('../lobbies');
const { findUserByAccountId, unlockHat: unlockHatForAccount, isQuestTierUnlocked } = require('../users');
const { backfillUnlockedHats } = require('../cosmetic');
const keyItemEffects = require('../keyItemEffects');
const {
  getKeyItemDef,
  unlockHatForPlayer,
  healAtMedic,
  assignRunSpawnPositions,
  stateSnapshot,
  savePlayerData,
  discardCardFromHand,
  addMagicStones,
  recordCrystalCollected,
  checkRunTerminalState,
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
    emitQuestPayloadToLobby,
    io,
    returnPlayersToLobby,
    giveUpRun,
    abandonSuspendedRun,
    claimCardReward,
    cardEffects,
    applyDebugScenario,
    isDebugScenarioAllowed,
    softDisconnectPlayerFromLobby,
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
      applyLayoutForQuest(
        lobby.state,
        lobby.state.selectedQuestId,
        lobby.state.selectedQuestTier ?? DEFAULT_QUEST_TIER,
      );
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
    if (Object.keys(lobby.state.players).length >= MAX_PLAYERS) {
      socket.emit('lobbyError', { reason: 'Lobby is full' });
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
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    if (state.suspendedCheckpoint) {
      socket.emit('questError', { reason: 'Abandon the suspended expedition before changing quests' });
      return;
    }

    const questId = data && typeof data.questId === 'string' ? data.questId : null;
    if (!questId) {
      socket.emit('questError', { reason: 'Missing questId' });
      return;
    }

    const tier = normalizeQuestTier(data && data.tier);

    if (!isValidQuestSelection(questId, tier)) {
      socket.emit('questError', { reason: `Unknown quest or tier: ${questId} tier ${tier}` });
      return;
    }

    if (tier >= 2 && !isQuestTierUnlocked(player.accountId, questId, tier)) {
      socket.emit('questError', { reason: 'tier_locked' });
      return;
    }

    state.selectedQuestId = questId;
    state.selectedQuestTier = tier;
    applyLayoutForQuest(state, questId, tier);
    assignRunSpawnPositions(Object.values(state.players));
    emitQuestPayloadToLobby(lobby, {
      extraFields: {
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      },
    });
    io.to(lobby.id).emit('stateUpdate', stateSnapshot());
    broadcastLobbyUpdate(lobby);
    });
  });

  deckHandlers.register(socket, ctx);
  tradeHandlers.register(socket, ctx);

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

  socket.on('move', (data) => {
    withLobbyFromSocket(socket, (state) => {
    if (!isPlayingPhase(state)) return;

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
    if (!isPlayingPhase(state)) return;
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

  socket.on('debugScenario', (data) => {
    const name = data && typeof data.name === 'string' ? data.name : '';
    if (!isDebugScenarioAllowed(socket)) {
      socket.emit('debugScenarioResult', { ok: false, reason: 'Debug scenarios are disabled' });
      return;
    }

    const result = applyDebugScenario(socket, name);
    socket.emit('debugScenarioResult', result);
  });

  socket.on('heartbeat', (data) => {
    if (!data || !Number.isFinite(data.timestamp)) {
      console.warn(`Rejected heartbeat from ${socket.id}: invalid payload`);
      return;
    }
    const lobby = lobbies.getLobbyForPlayer(socket.playerId);
    if (lobby && lobby.state.players[socket.playerId]) {
      lobby.state.players[socket.playerId].lastActivity = Date.now();
    }
    socket.emit('heartbeat_ack', { latency: Date.now() - data.timestamp });
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

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    if (!socket.playerId) return;

    const lobby = lobbies.getLobbyForPlayer(socket.playerId);
    if (lobby && lobby.state.players[socket.playerId]) {
      softDisconnectPlayerFromLobby(socket);
      return;
    }

    lobbies.removeSession(socket.playerId);
  });
}

module.exports = { register };
