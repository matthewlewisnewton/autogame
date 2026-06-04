/**
 * Shared helpers for socket-driven lobby lifecycle flows.
 */

let _deps = null;

function setCallbacks(deps) {
  _deps = deps;
}

function notifyPlayerRemoved(lobby, playerId, result) {
  const { io, withLobbyContext, isPlayingPhase, checkRunTerminalState, broadcastLobbyUpdate } = _deps;
  io.to(lobby.id).emit('playerDisconnected', playerId);
  if (result && !result.deleted) {
    withLobbyContext(lobby, () => {
      if (isPlayingPhase(lobby.state)) {
        checkRunTerminalState();
      } else {
        broadcastLobbyUpdate(lobby);
      }
    });
  }
}

module.exports = { setCallbacks, notifyPlayerRemoved };
