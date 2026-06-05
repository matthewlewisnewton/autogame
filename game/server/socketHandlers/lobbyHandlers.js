// ── Lobby Socket Handlers ──
// Registers lobby-browser, cosmetic/medic, and connection-adjacent socket.on handlers that previously
// lived inline in the io.on('connection') closure in index.js.
// Run-lifecycle handlers live in runHandlers.js.
// Deck/shop/inventory handlers live in deckHandlers.js.
// Trade handlers live in tradeHandlers.js.
// Key-item handlers live in keyItemHandlers.js.
//
// ── Circular-dependency resolution ──
// This module must NOT require('./index') (circular). Per-connection identity
// and index.js-local helpers are supplied via the ctx object passed to
// register(socket, ctx) from the connection handler.

const { MAX_PLAYERS } = require('../config');
const deckHandlers = require('./deckHandlers');
const tradeHandlers = require('./tradeHandlers');
const keyItemHandlers = require('./keyItemHandlers');
const runHandlers = require('./runHandlers');
const {
  DEFAULT_QUEST_TIER,
  isValidQuestSelection,
  normalizeQuestTier,
} = require('../quests');
const { findUserByAccountId, unlockHat: unlockHatForAccount, isQuestTierUnlocked } = require('../users');
const { backfillUnlockedHats } = require('../cosmetic');
const {
  unlockHatForPlayer,
  healAtMedic,
  assignRunSpawnPositions,
  stateSnapshot,
  savePlayerData,
} = require('../progression');

function register(socket, ctx) {
  const {
    playerId,
    sessionPlayer,
    lobbies,
    withLobbyContext,
    applyLayoutForQuest,
    ensureShopOffer,
    joinPlayerToLobby,
    joinLobbyWithPhasePolicy,
    leaveLobbyForSocket,
    buildSessionFromPlayer,
    reconnectPlayerToLobby,
    withLobbyPlayer,
    broadcastLobbyUpdate,
    emitQuestPayloadToLobby,
    io,
    applyDebugScenario,
    isDebugScenarioAllowed,
    softDisconnectPlayerFromLobby,
  } = ctx;

  socket.on('listLobbies', () => {
    socket.emit('lobbyListUpdate', { lobbies: lobbies.listLobbySummaries() });
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
  keyItemHandlers.register(socket, ctx);
  runHandlers.register(socket, ctx);

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
