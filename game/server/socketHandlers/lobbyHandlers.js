// ── Lobby Socket Handlers ──
// Registers lobby-browser, cosmetic/medic, and connection-adjacent socket.on handlers that previously
// lived inline in the io.on('connection') closure in index.js.
// Run-lifecycle handlers live in runHandlers.js.
// Deck/shop/inventory handlers live in deckHandlers.js.
// Trade handlers live in tradeHandlers.js.
// Key-item handlers live in keyItemHandlers.js.
//
// ── Circular-dependency resolution ──
const EVENTS = require('../../shared/events.json');
// This module must NOT require('./index') (circular). Per-connection identity
// and index.js-local helpers are supplied via the ctx object passed to
// register(socket, ctx) from the connection handler.

const { MAX_PLAYERS } = require('../config');
const { findBoothInRange } = require('../../shared/boothZones.js');
const { isLobbyPhase } = require('../lobbies');
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
    hubLayout,
  } = ctx;

  socket.on(EVENTS.listLobbies, () => {
    socket.emit(EVENTS.lobbyListUpdate, { lobbies: lobbies.listLobbySummaries() });
  });

  socket.on(EVENTS.createLobby, (data) => {
    if (lobbies.getLobbyForPlayer(playerId)) {
      socket.emit(EVENTS.lobbyError, { reason: 'Already in a lobby' });
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

  socket.on(EVENTS.joinLobby, (data) => {
    const existingLobby = lobbies.getLobbyForPlayer(playerId);
    if (existingLobby) {
      const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
      const player = existingLobby.state.players[playerId];
      if (player && player.connected === false && lobbyId === existingLobby.id) {
        reconnectPlayerToLobby(socket, existingLobby);
        return;
      }
      socket.emit(EVENTS.lobbyError, { reason: 'Already in a lobby' });
      return;
    }
    const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
    if (!lobbyId) {
      socket.emit(EVENTS.lobbyError, { reason: 'Missing lobbyId' });
      return;
    }
    const lobby = lobbies.getLobbyById(lobbyId);
    if (!lobby) {
      socket.emit(EVENTS.lobbyError, { reason: 'Lobby not found' });
      return;
    }
    if (Object.keys(lobby.state.players).length >= MAX_PLAYERS) {
      socket.emit(EVENTS.lobbyError, { reason: 'Lobby is full' });
      return;
    }
    joinLobbyWithPhasePolicy(socket, lobby);
  });

  socket.on(EVENTS.leaveLobby, () => {
    if (!lobbies.getLobbyForPlayer(playerId)) {
      socket.emit(EVENTS.lobbyError, { reason: 'Not in a lobby' });
      return;
    }
    leaveLobbyForSocket(socket);
    const session = lobbies.getSession(playerId) || buildSessionFromPlayer(sessionPlayer);
    lobbies.registerSession(playerId, session);
    socket.emit(EVENTS.lobbyLeft, {
      lobbies: lobbies.listLobbySummaries(),
    });
  });

  socket.on(EVENTS.selectQuest, (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    if (state.suspendedCheckpoint) {
      socket.emit(EVENTS.questError, { reason: 'Abandon the suspended expedition before changing quests' });
      return;
    }

    const questId = data && typeof data.questId === 'string' ? data.questId : null;
    if (!questId) {
      socket.emit(EVENTS.questError, { reason: 'Missing questId' });
      return;
    }

    const tier = normalizeQuestTier(data && data.tier);

    if (!isValidQuestSelection(questId, tier)) {
      socket.emit(EVENTS.questError, { reason: `Unknown quest or tier: ${questId} tier ${tier}` });
      return;
    }

    if (tier >= 2 && !isQuestTierUnlocked(player.accountId, questId, tier)) {
      socket.emit(EVENTS.questError, { reason: 'tier_locked' });
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
    io.to(lobby.id).emit(EVENTS.stateUpdate, stateSnapshot());
    broadcastLobbyUpdate(lobby);
    });
  });

  deckHandlers.register(socket, ctx);
  tradeHandlers.register(socket, ctx);
  keyItemHandlers.register(socket, ctx);
  runHandlers.register(socket, ctx);

  socket.on(EVENTS.unlockHat, (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    const hatId = data && typeof data.hatId === 'string' ? data.hatId : null;
    if (!hatId) {
      socket.emit(EVENTS.hatError, { reason: 'Missing hatId' });
      return;
    }

    // Reject early if the account already owns the hat — no currency change.
    const account = findUserByAccountId(player.accountId);
    if (!account) {
      socket.emit(EVENTS.hatError, { reason: 'Account not found' });
      return;
    }
    const owned = backfillUnlockedHats(account.unlockedHats);
    if (owned.includes(hatId)) {
      socket.emit(EVENTS.hatError, { reason: 'Hat already unlocked' });
      return;
    }

    // Deduct currency (validates the hat exists and affordability).
    const result = unlockHatForPlayer(player, hatId);
    if (!result.ok) {
      socket.emit(EVENTS.hatError, { reason: result.reason });
      return;
    }

    // Persist deducted currency before recording the hat on the account.
    // Safe ordering: currency first, hat second — a crash after this save but
    // before unlock leaves charged-but-not-unlocked (retryable via unlockHat)
    // instead of unlocked-but-not-charged (free-hat exploit).
    const saved = savePlayerData(socket.playerId);
    if (!saved) {
      player.currency += result.cost;
      socket.emit(EVENTS.hatError, { reason: 'Failed to save progress' });
      return;
    }

    const unlockResult = unlockHatForAccount(player.accountId, hatId);
    if (!unlockResult.ok) {
      // Refund in memory and re-save so disk matches RAM; otherwise the first
      // save would leave deducted currency on disk without a hat unlock.
      player.currency += result.cost;
      savePlayerData(socket.playerId);
      socket.emit(EVENTS.hatError, { reason: unlockResult.reason });
      return;
    }

    socket.emit(EVENTS.hatUnlocked, {
      unlockedHats: unlockResult.unlockedHats,
      currency: player.currency
    });
    savePlayerData(socket.playerId);
    });
  });

  socket.on(EVENTS.medicHeal, () => {
    withLobbyPlayer(socket, {
      requirePhase: 'lobby',
      phaseMismatch: { event: 'medicError', payload: { reason: 'not_in_lobby' } },
    }, (state, lobby, player) => {
      const result = healAtMedic(socket.playerId, state);
      if (!result.ok) {
        socket.emit(EVENTS.medicError, { reason: result.reason });
        return;
      }

      socket.emit(EVENTS.medicHealed, {
        hp: result.hp,
        currency: player.currency,
        cost: result.cost,
      });
      io.to(state._lobbyId).emit(EVENTS.stateUpdate, stateSnapshot());
    });
  });

  socket.on(EVENTS.boothInteract, (data) => {
    // Booth interactions only exist while in the hub lobby phase. Emit
    // boothError (not lobbyError) for every rejection so the client can
    // listen on a single channel.
    const lobby = lobbies.getLobbyForPlayer(playerId);
    if (!lobby || !isLobbyPhase(lobby.state)) {
      socket.emit(EVENTS.boothError, { reason: 'not_in_lobby' });
      return;
    }
    const player = lobby.state.players[playerId];
    if (!player) {
      socket.emit(EVENTS.boothError, { reason: 'not_in_lobby' });
      return;
    }

    const boothAnchors = hubLayout && hubLayout.boothAnchors;
    if (!boothAnchors) {
      socket.emit(EVENTS.boothError, { reason: 'no_booths' });
      return;
    }

    const boothId = data && typeof data.boothId === 'string' ? data.boothId : null;
    if (!boothId || !Object.prototype.hasOwnProperty.call(boothAnchors, boothId)) {
      socket.emit(EVENTS.boothError, { reason: 'unknown_booth' });
      return;
    }

    // Authoritative proximity check against the player's server-side position.
    const inRange = findBoothInRange(boothAnchors, player.x, player.z);
    if (inRange !== boothId) {
      socket.emit(EVENTS.boothError, { reason: 'out_of_range' });
      return;
    }

    socket.emit(EVENTS.boothAction, { boothId, action: boothId });
  });

  socket.on(EVENTS.debugScenario, (data) => {
    const name = data && typeof data.name === 'string' ? data.name : '';
    if (!isDebugScenarioAllowed(socket)) {
      socket.emit(EVENTS.debugScenarioResult, { ok: false, reason: 'Debug scenarios are disabled' });
      return;
    }

    const result = applyDebugScenario(socket, name);
    socket.emit(EVENTS.debugScenarioResult, result);
  });

  socket.on(EVENTS.heartbeat, (data) => {
    if (!data || !Number.isFinite(data.timestamp)) {
      console.warn(`Rejected heartbeat from ${socket.id}: invalid payload`);
      return;
    }
    const lobby = lobbies.getLobbyForPlayer(socket.playerId);
    if (lobby && lobby.state.players[socket.playerId]) {
      lobby.state.players[socket.playerId].lastActivity = Date.now();
    }
    socket.emit(EVENTS.heartbeat_ack, { latency: Date.now() - data.timestamp });
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
