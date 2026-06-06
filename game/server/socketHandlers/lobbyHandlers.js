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

const { CLIENT_TO_SERVER, SERVER_TO_CLIENT } = require('../../shared/events.js');
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
const { hasAppearanceFieldChanges } = require('../../shared/cosmeticAppearance.js');
const { findUserByAccountId, unlockHat: unlockHatForAccount, isQuestTierUnlocked, updateProfile } = require('../users');
const { backfillUnlockedHats, backfillCosmetic, validateCosmetic } = require('../cosmetic');
const {
  unlockHatForPlayer,
  chargeAppearanceChangeForPlayer,
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
    syncLivePlayerCosmetic,
  } = ctx;

  socket.on(CLIENT_TO_SERVER.LIST_LOBBIES, () => {
    socket.emit(SERVER_TO_CLIENT.LOBBY_LIST_UPDATE, { lobbies: lobbies.listLobbySummaries() });
  });

  socket.on(CLIENT_TO_SERVER.CREATE_LOBBY, (data) => {
    if (lobbies.getLobbyForPlayer(playerId)) {
      socket.emit(SERVER_TO_CLIENT.LOBBY_ERROR, { reason: 'Already in a lobby' });
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

  socket.on(CLIENT_TO_SERVER.JOIN_LOBBY, (data) => {
    const existingLobby = lobbies.getLobbyForPlayer(playerId);
    if (existingLobby) {
      const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
      const player = existingLobby.state.players[playerId];
      if (player && player.connected === false && lobbyId === existingLobby.id) {
        reconnectPlayerToLobby(socket, existingLobby);
        return;
      }
      socket.emit(SERVER_TO_CLIENT.LOBBY_ERROR, { reason: 'Already in a lobby' });
      return;
    }
    const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
    if (!lobbyId) {
      socket.emit(SERVER_TO_CLIENT.LOBBY_ERROR, { reason: 'Missing lobbyId' });
      return;
    }
    const lobby = lobbies.getLobbyById(lobbyId);
    if (!lobby) {
      socket.emit(SERVER_TO_CLIENT.LOBBY_ERROR, { reason: 'Lobby not found' });
      return;
    }
    if (Object.keys(lobby.state.players).length >= MAX_PLAYERS) {
      socket.emit(SERVER_TO_CLIENT.LOBBY_ERROR, { reason: 'Lobby is full' });
      return;
    }
    joinLobbyWithPhasePolicy(socket, lobby);
  });

  socket.on(CLIENT_TO_SERVER.LEAVE_LOBBY, () => {
    if (!lobbies.getLobbyForPlayer(playerId)) {
      socket.emit(SERVER_TO_CLIENT.LOBBY_ERROR, { reason: 'Not in a lobby' });
      return;
    }
    leaveLobbyForSocket(socket);
    const session = lobbies.getSession(playerId) || buildSessionFromPlayer(sessionPlayer);
    lobbies.registerSession(playerId, session);
    socket.emit(SERVER_TO_CLIENT.LOBBY_LEFT, {
      lobbies: lobbies.listLobbySummaries(),
    });
  });

  socket.on(CLIENT_TO_SERVER.SELECT_QUEST, (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    const questId = data && typeof data.questId === 'string' ? data.questId : null;
    if (!questId) {
      socket.emit(SERVER_TO_CLIENT.QUEST_ERROR, { reason: 'Missing questId' });
      return;
    }

    const tier = normalizeQuestTier(data && data.tier);

    if (!isValidQuestSelection(questId, tier)) {
      socket.emit(SERVER_TO_CLIENT.QUEST_ERROR, { reason: `Unknown quest or tier: ${questId} tier ${tier}` });
      return;
    }

    if (tier >= 2 && !isQuestTierUnlocked(player.accountId, questId, tier)) {
      socket.emit(SERVER_TO_CLIENT.QUEST_ERROR, { reason: 'tier_locked' });
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
    io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
    broadcastLobbyUpdate(lobby);
    });
  });

  deckHandlers.register(socket, ctx);
  tradeHandlers.register(socket, ctx);
  keyItemHandlers.register(socket, ctx);
  runHandlers.register(socket, ctx);

  socket.on(CLIENT_TO_SERVER.UNLOCK_HAT, (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, player) => {
    const hatId = data && typeof data.hatId === 'string' ? data.hatId : null;
    if (!hatId) {
      socket.emit(SERVER_TO_CLIENT.HAT_ERROR, { reason: 'Missing hatId' });
      return;
    }

    // Reject early if the account already owns the hat — no currency change.
    const account = findUserByAccountId(player.accountId);
    if (!account) {
      socket.emit(SERVER_TO_CLIENT.HAT_ERROR, { reason: 'Account not found' });
      return;
    }
    const owned = backfillUnlockedHats(account.unlockedHats);
    if (owned.includes(hatId)) {
      socket.emit(SERVER_TO_CLIENT.HAT_ERROR, { reason: 'Hat already unlocked' });
      return;
    }

    // Deduct currency (validates the hat exists and affordability).
    const result = unlockHatForPlayer(player, hatId);
    if (!result.ok) {
      socket.emit(SERVER_TO_CLIENT.HAT_ERROR, { reason: result.reason });
      return;
    }

    // Persist deducted currency before recording the hat on the account.
    // Safe ordering: currency first, hat second — a crash after this save but
    // before unlock leaves charged-but-not-unlocked (retryable via unlockHat)
    // instead of unlocked-but-not-charged (free-hat exploit).
    const saved = savePlayerData(socket.playerId);
    if (!saved) {
      player.currency += result.cost;
      socket.emit(SERVER_TO_CLIENT.HAT_ERROR, { reason: 'Failed to save progress' });
      return;
    }

    const unlockResult = unlockHatForAccount(player.accountId, hatId);
    if (!unlockResult.ok) {
      // Refund in memory and re-save so disk matches RAM; otherwise the first
      // save would leave deducted currency on disk without a hat unlock.
      player.currency += result.cost;
      savePlayerData(socket.playerId);
      socket.emit(SERVER_TO_CLIENT.HAT_ERROR, { reason: unlockResult.reason });
      return;
    }

    socket.emit(SERVER_TO_CLIENT.HAT_UNLOCKED, {
      unlockedHats: unlockResult.unlockedHats,
      currency: player.currency
    });
    savePlayerData(socket.playerId);
    });
  });

  socket.on(CLIENT_TO_SERVER.APPLY_APPEARANCE_CHANGE, (data) => {
    const lobby = lobbies.getLobbyForPlayer(playerId);
    if (!lobby || !isLobbyPhase(lobby.state)) {
      socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: 'not_in_lobby' });
      return;
    }
    const player = lobby.state.players[playerId];
    if (!player) {
      socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: 'not_in_lobby' });
      return;
    }

    withLobbyContext(lobby, () => {
      const proposed = data && data.cosmetic;
      if (!proposed || typeof proposed !== 'object' || Array.isArray(proposed)) {
        socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: 'Invalid cosmetic' });
        return;
      }

      const account = findUserByAccountId(player.accountId);
      if (!account) {
        socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: 'Account not found' });
        return;
      }

      const validation = validateCosmetic(proposed);
      if (!validation.ok) {
        socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: validation.reason });
        return;
      }

      if (validation.value.hat !== undefined) {
        const unlocked = backfillUnlockedHats(account.unlockedHats);
        if (!unlocked.includes(validation.value.hat)) {
          socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: 'Hat is not unlocked for this account' });
          return;
        }
      }

      const base = backfillCosmetic(account.cosmetic);
      const value = validation.value;
      const merged = value.proportions
        ? { ...base, ...value, proportions: { ...base.proportions, ...value.proportions } }
        : { ...base, ...value };
      const paidChange = hasAppearanceFieldChanges(base, merged);

      const finishSuccess = (cost) => {
        const user = findUserByAccountId(player.accountId);
        syncLivePlayerCosmetic(player.accountId, user.cosmetic);
        io.to(lobby.id).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
        socket.emit(SERVER_TO_CLIENT.APPEARANCE_CHANGED, {
          cosmetic: user.cosmetic,
          currency: player.currency,
          cost,
        });
        savePlayerData(socket.playerId);
      };

      if (!paidChange) {
        const profileResult = updateProfile(player.accountId, { cosmetic: proposed });
        if (!profileResult.ok) {
          socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: profileResult.reason });
          return;
        }
        finishSuccess(0);
        return;
      }

      const chargeResult = chargeAppearanceChangeForPlayer(player);
      if (!chargeResult.ok) {
        socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: chargeResult.reason });
        return;
      }

      // Safe ordering: currency first, cosmetic second — a crash after this save
      // but before updateProfile leaves charged-but-not-applied (retryable) instead
      // of applied-but-not-charged (free-appearance exploit).
      const saved = savePlayerData(socket.playerId);
      if (!saved) {
        player.currency += chargeResult.cost;
        socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: 'Failed to save progress' });
        return;
      }

      const profileResult = updateProfile(player.accountId, { cosmetic: proposed });
      if (!profileResult.ok) {
        player.currency += chargeResult.cost;
        savePlayerData(socket.playerId);
        socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: profileResult.reason });
        return;
      }

      finishSuccess(chargeResult.cost);
    });
  });

  socket.on(CLIENT_TO_SERVER.MEDIC_HEAL, () => {
    withLobbyPlayer(socket, {
      requirePhase: 'lobby',
      phaseMismatch: { event: SERVER_TO_CLIENT.MEDIC_ERROR, payload: { reason: 'not_in_lobby' } },
    }, (state, lobby, player) => {
      const result = healAtMedic(socket.playerId, state);
      if (!result.ok) {
        socket.emit(SERVER_TO_CLIENT.MEDIC_ERROR, { reason: result.reason });
        return;
      }

      socket.emit(SERVER_TO_CLIENT.MEDIC_HEALED, {
        hp: result.hp,
        currency: player.currency,
        cost: result.cost,
      });
      io.to(state._lobbyId).emit(SERVER_TO_CLIENT.STATE_UPDATE, stateSnapshot());
    });
  });

  socket.on(CLIENT_TO_SERVER.BOOTH_INTERACT, (data) => {
    // Booth interactions only exist while in the hub lobby phase. Emit
    // boothError (not lobbyError) for every rejection so the client can
    // listen on a single channel.
    const lobby = lobbies.getLobbyForPlayer(playerId);
    if (!lobby || !isLobbyPhase(lobby.state)) {
      socket.emit(SERVER_TO_CLIENT.BOOTH_ERROR, { reason: 'not_in_lobby' });
      return;
    }
    const player = lobby.state.players[playerId];
    if (!player) {
      socket.emit(SERVER_TO_CLIENT.BOOTH_ERROR, { reason: 'not_in_lobby' });
      return;
    }

    const boothAnchors = hubLayout && hubLayout.boothAnchors;
    if (!boothAnchors) {
      socket.emit(SERVER_TO_CLIENT.BOOTH_ERROR, { reason: 'no_booths' });
      return;
    }

    const boothId = data && typeof data.boothId === 'string' ? data.boothId : null;
    if (!boothId || !Object.prototype.hasOwnProperty.call(boothAnchors, boothId)) {
      socket.emit(SERVER_TO_CLIENT.BOOTH_ERROR, { reason: 'unknown_booth' });
      return;
    }

    // Authoritative proximity check against the player's server-side position.
    const inRange = findBoothInRange(boothAnchors, player.x, player.z);
    if (inRange !== boothId) {
      socket.emit(SERVER_TO_CLIENT.BOOTH_ERROR, { reason: 'out_of_range' });
      return;
    }

    socket.emit(SERVER_TO_CLIENT.BOOTH_ACTION, { boothId, action: boothId });
  });

  socket.on(CLIENT_TO_SERVER.DEBUG_SCENARIO, (data) => {
    const name = data && typeof data.name === 'string' ? data.name : '';
    if (!isDebugScenarioAllowed(socket)) {
      socket.emit(SERVER_TO_CLIENT.DEBUG_SCENARIO_RESULT, { ok: false, reason: 'Debug scenarios are disabled' });
      return;
    }

    const result = applyDebugScenario(socket, name);
    socket.emit(SERVER_TO_CLIENT.DEBUG_SCENARIO_RESULT, result);
  });

  socket.on(CLIENT_TO_SERVER.TOGGLE_DEBUG_GODMODE, () => {
    if (!isDebugScenarioAllowed(socket)) {
      socket.emit(SERVER_TO_CLIENT.DEBUG_GODMODE_RESULT, { ok: false, reason: 'Debug godmode is disabled' });
      return;
    }

    withLobbyPlayer(socket, {}, (state, lobby, player) => {
      player.debugGodmode = !player.debugGodmode;
      socket.emit(SERVER_TO_CLIENT.DEBUG_GODMODE_RESULT, { ok: true, enabled: player.debugGodmode });
    });
  });

  socket.on(CLIENT_TO_SERVER.HEARTBEAT, (data) => {
    if (!data || !Number.isFinite(data.timestamp)) {
      console.warn(`Rejected heartbeat from ${socket.id}: invalid payload`);
      return;
    }
    const lobby = lobbies.getLobbyForPlayer(socket.playerId);
    if (lobby && lobby.state.players[socket.playerId]) {
      lobby.state.players[socket.playerId].lastActivity = Date.now();
    }
    socket.emit(SERVER_TO_CLIENT.HEARTBEAT_ACK, { latency: Date.now() - data.timestamp });
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
