// Socket.IO helpers for progression modules. Stores callbacks only — no game state.

const { SERVER_TO_CLIENT } = require('../../shared/events.js');
const { isPlayingPhase } = require('../lobbies');

let _getIo = () => null;
let _broadcastLobbyUpdate = () => {};
let _rebuildWallColliders = () => {};
let _previewReturnRewards = () => null;

function setProgressionCallbacks({ getIo, broadcastLobbyUpdate, rebuildWallColliders, previewReturnRewards } = {}) {
  if (typeof getIo === 'function') _getIo = getIo;
  if (typeof broadcastLobbyUpdate === 'function') _broadcastLobbyUpdate = broadcastLobbyUpdate;
  if (typeof rebuildWallColliders === 'function') _rebuildWallColliders = rebuildWallColliders;
  if (typeof previewReturnRewards === 'function') _previewReturnRewards = previewReturnRewards;
}

function getBroadcastLobbyUpdate() {
  return _broadcastLobbyUpdate;
}

function getRebuildWallColliders() {
  return _rebuildWallColliders;
}

function getIoTarget(state) {
  const io = _getIo();
  if (!io) return null;
  const { getLobbyById, _lobbies } = require('../lobbies');
  if (state && state._lobbyId && typeof io.to === 'function') {
    if (getLobbyById(state._lobbyId)) {
      return io.to(state._lobbyId);
    }
  }
  if (state && _lobbies) {
    for (const lobby of _lobbies.values()) {
      if (lobby.state === state) {
        return io.to(lobby.id);
      }
    }
  }
  return io;
}

function buildPlayerDeckUpdatePayload(state, player, extra = {}) {
  const payload = {
    deck: Array.isArray(player.deck) ? [...player.deck] : [],
    hand: Array.isArray(player.hand)
      ? player.hand.map((card) => (card ? { ...card } : null))
      : [],
    desperationDeck: Array.isArray(player.desperationDeck) ? [...player.desperationDeck] : [],
    inDesperation: !!player.inDesperation,
    nextDrawAt: player.nextDrawAt ?? null,
    ...extra,
  };
  if (player.runRewards != null) {
    payload.runRewards = player.runRewards;
  }
  if (player.id && typeof _previewReturnRewards === 'function') {
    const preview = _previewReturnRewards(state, player.id);
    if (preview != null) {
      payload.returnRewardsPreview = preview;
    }
  }
  return payload;
}

function emitPlayerDeckUpdate(state, playerId, extra = {}) {
  if (!state || !isPlayingPhase(state)) return;
  const player = state.players[playerId];
  if (!player) return;
  const socketId = player.activeSocketId;
  if (!socketId) return;
  const io = _getIo();
  if (!io || typeof io.to !== 'function') return;
  io.to(socketId).emit(SERVER_TO_CLIENT.DECK_UPDATE, buildPlayerDeckUpdatePayload(state, player, extra));
}

function maybeEmitPlayerDeckUpdate(state, player) {
  if (!player || !player.id) return;
  emitPlayerDeckUpdate(state, player.id);
}

function emitLobbyDeploy(io, state, event, payload) {
  if (!io) return;
  const lobbyId = state && state._lobbyId;
  try {
    if (lobbyId) {
      io.to(lobbyId).emit(event, payload);
    } else {
      io.emit(event, payload);
    }
  } catch (err) {
    console.error(`[checkAllReady] ${event} emit failed:`, err && err.stack ? err.stack : err);
  }
}

module.exports = {
  setProgressionCallbacks,
  getBroadcastLobbyUpdate,
  getRebuildWallColliders,
  getIoTarget,
  buildPlayerDeckUpdatePayload,
  emitPlayerDeckUpdate,
  maybeEmitPlayerDeckUpdate,
  emitLobbyDeploy,
};
