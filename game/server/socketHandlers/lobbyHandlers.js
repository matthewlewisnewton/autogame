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
  stateSnapshot,
  savePlayerData,
  abandonSuspendedRun,
} = require('../progression');
const { listGlobalLobbySummaries } = require('../lobbyBrowser');

function register(socket, ctx) {
  const {
    playerId,
    sessionPlayer,
    lobbies,
    withLobbyContext,
    applyLayoutForQuest,
    previewLayoutForQuest,
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
    unregisterPlayerSocket,
    hubLayout,
    lobbyBrowserRoom,
    syncLivePlayerCosmetic,
    validateSocketSession,
  } = ctx;

  socket.on(CLIENT_TO_SERVER.LIST_LOBBIES, () => {
    socket.join(lobbyBrowserRoom);
    void listGlobalLobbySummaries()
      .then((lobbyList) => {
        socket.emit(SERVER_TO_CLIENT.LOBBY_LIST_UPDATE, { lobbies: lobbyList });
      })
      .catch((err) => {
        console.error('[lobbyBrowser] listLobbies failed:', err);
        socket.emit(SERVER_TO_CLIENT.LOBBY_LIST_UPDATE, { lobbies: lobbies.listLobbySummaries() });
      });
  });

  socket.on(CLIENT_TO_SERVER.CREATE_LOBBY, (data) => {
    return lobbies.withMembershipLock(async () => {
      if (!socket.connected) return;
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
      try {
        const joined = await joinPlayerToLobby(socket, lobby);
        if (!joined) lobbies.deleteLobbyIfEmpty(lobby.id);
      } catch (err) {
        lobbies.deleteLobbyIfEmpty(lobby.id);
        throw err;
      }
    });
  });

  socket.on(CLIENT_TO_SERVER.JOIN_LOBBY, (data) => {
    return lobbies.withMembershipLock(async () => {
      if (!socket.connected) return;
      const existingLobby = lobbies.getLobbyForPlayer(playerId);
      if (existingLobby) {
        const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
        const player = existingLobby.state.players[playerId];
        if (player && player.connected === false && lobbyId === existingLobby.id) {
          await reconnectPlayerToLobby(socket, existingLobby);
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
      await joinLobbyWithPhasePolicy(socket, lobby);
    });
  });

  socket.on(CLIENT_TO_SERVER.LEAVE_LOBBY, () => {
    if (!lobbies.getLobbyForPlayer(playerId)) {
      socket.emit(SERVER_TO_CLIENT.LOBBY_ERROR, { reason: 'Not in a lobby' });
      return;
    }
    leaveLobbyForSocket(socket);
    socket.join(lobbyBrowserRoom);
    const session = lobbies.getSession(playerId) || buildSessionFromPlayer(sessionPlayer);
    lobbies.registerSession(playerId, session);
    void listGlobalLobbySummaries()
      .then((lobbyList) => {
        socket.emit(SERVER_TO_CLIENT.LOBBY_LEFT, { lobbies: lobbyList });
      })
      .catch((err) => {
        console.error('[lobbyBrowser] lobbyLeft list failed:', err);
        socket.emit(SERVER_TO_CLIENT.LOBBY_LEFT, { lobbies: lobbies.listLobbySummaries() });
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

    if (state.suspendedCheckpoint) {
      // Same quest+tier as suspended run → still locked (unchanged behavior).
      // Different quest+tier → implicitly abandon checkpoint and allow selection.
      const runQuestId = state.suspendedCheckpoint.run.questId;
      const runQuestTier = state.suspendedCheckpoint.run.questTier ?? DEFAULT_QUEST_TIER;
      if (questId === runQuestId && tier === runQuestTier) {
        socket.emit(SERVER_TO_CLIENT.QUEST_ERROR, { reason: 'suspended_checkpoint' });
        return;
      }
      abandonSuspendedRun(state);
    }

    if (!isValidQuestSelection(questId, tier)) {
      socket.emit(SERVER_TO_CLIENT.QUEST_ERROR, { reason: `Unknown quest or tier: ${questId} tier ${tier}` });
      return;
    }

    if (!isQuestTierUnlocked(player.accountId, questId, tier)) {
      socket.emit(SERVER_TO_CLIENT.QUEST_ERROR, { reason: 'tier_locked' });
      return;
    }

    state.selectedQuestId = questId;
    state.selectedQuestTier = tier;
    // Record the selection only. The real layout swap + spawn teleport are
    // deferred to deploy (checkAllReadyInner) so the lobby stays on the live hub
    // and players keep moving/interacting. Emit a non-destructive preview the
    // client can cache for deploy (applyQuestLayoutFromServer reads
    // data.layout/data.layoutSeed) — deterministic for this questId+tier, the
    // same seed the run will use.
    const { layoutSeed, layout } = previewLayoutForQuest(questId, tier);
    emitQuestPayloadToLobby(lobby, {
      extraFields: {
        layoutSeed,
        layout,
      },
    });
    broadcastLobbyUpdate(lobby);
    });
  });

  deckHandlers.register(socket, ctx);
  tradeHandlers.register(socket, ctx);
  keyItemHandlers.register(socket, ctx);
  runHandlers.register(socket, ctx);

  socket.on(CLIENT_TO_SERVER.UNLOCK_HAT, (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, async (state, lobby, player) => {
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
    const saved = await savePlayerData(socket.playerId);
    if (!saved) {
      player.currency += result.cost;
      socket.emit(SERVER_TO_CLIENT.HAT_ERROR, { reason: 'Failed to save progress' });
      return;
    }

    const unlockResult = await unlockHatForAccount(player.accountId, hatId);
    if (!unlockResult.ok) {
      // Refund in memory and re-save so disk matches RAM; otherwise the first
      // save would leave deducted currency on disk without a hat unlock.
      player.currency += result.cost;
      await savePlayerData(socket.playerId);
      socket.emit(SERVER_TO_CLIENT.HAT_ERROR, { reason: unlockResult.reason });
      return;
    }

    socket.emit(SERVER_TO_CLIENT.HAT_UNLOCKED, {
      unlockedHats: unlockResult.unlockedHats,
      currency: player.currency
    });
    void savePlayerData(socket.playerId);
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

    withLobbyContext(lobby, async () => {
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
        void savePlayerData(socket.playerId);
      };

      if (!paidChange) {
        const profileResult = await updateProfile(player.accountId, { cosmetic: proposed });
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
      const saved = await savePlayerData(socket.playerId);
      if (!saved) {
        player.currency += chargeResult.cost;
        socket.emit(SERVER_TO_CLIENT.APPEARANCE_ERROR, { reason: 'Failed to save progress' });
        return;
      }

      const profileResult = await updateProfile(player.accountId, { cosmetic: proposed });
      if (!profileResult.ok) {
        player.currency += chargeResult.cost;
        await savePlayerData(socket.playerId);
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

    Promise.resolve(applyDebugScenario(socket, name)).then((result) => {
      socket.emit(SERVER_TO_CLIENT.DEBUG_SCENARIO_RESULT, result);
    });
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

  socket.on(CLIENT_TO_SERVER.SET_DEBUG_TIME_SCALE, (data) => {
    // Time scaling is gated strictly on ALLOW_DEBUG_SCENARIOS=1, NOT the
    // localhost-permissive isDebugScenarioAllowed path: a normal local dev
    // session must not slow the sim unless the operator explicitly opted in.
    if (process.env.ALLOW_DEBUG_SCENARIOS !== '1') {
      socket.emit(SERVER_TO_CLIENT.DEBUG_TIME_SCALE_RESULT, { ok: false, reason: 'Debug time scale is disabled' });
      return;
    }

    const scale = data && data.scale;
    if (!Number.isFinite(scale)) {
      socket.emit(SERVER_TO_CLIENT.DEBUG_TIME_SCALE_RESULT, { ok: false, reason: 'Invalid time scale' });
      return;
    }

    const clamped = Math.max(0, Math.min(1, scale));
    withLobbyPlayer(socket, {}, (state) => {
      state.debugTimeScale = clamped;
      socket.emit(SERVER_TO_CLIENT.DEBUG_TIME_SCALE_RESULT, { ok: true, scale: clamped });
    });
  });

  socket.on(CLIENT_TO_SERVER.HEARTBEAT, async (data) => {
    if (!data || !Number.isFinite(data.timestamp)) {
      console.warn(`Rejected heartbeat from ${socket.id}: invalid payload`);
      return;
    }
    if (!(await validateSocketSession(socket))) return;
    const lobby = lobbies.getLobbyForPlayer(socket.playerId);
    if (lobby && lobby.state.players[socket.playerId]) {
      lobby.state.players[socket.playerId].lastActivity = Date.now();
    }
    socket.emit(SERVER_TO_CLIENT.HEARTBEAT_ACK, { latency: Date.now() - data.timestamp });
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    if (!socket.playerId) return;

    unregisterPlayerSocket(socket.playerId, socket);

    const lobby = lobbies.getLobbyForPlayer(socket.playerId);
    if (lobby && lobby.state.players[socket.playerId]) {
      softDisconnectPlayerFromLobby(socket);
      return;
    }

    lobbies.removeSession(socket.playerId);
  });
}

module.exports = { register };
