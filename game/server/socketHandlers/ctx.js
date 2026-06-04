/**
 * Per-connection context for socket event handlers.
 * Built once in the connection handler; passed to register(socket, ctx).
 */
function createSocketHandlerCtx(deps) {
  const {
    socket,
    playerId,
    accountId,
    username,
    sessionPlayer,
    getLobbyForSocket,
    withLobbyFromSocket,
    withLobbyPlayer,
    broadcastLobbyUpdate,
    findSocketByPlayerId,
    savePlayerData,
    isDebugScenarioAllowed,
    applyDebugScenario,
    softDisconnectPlayerFromLobby,
  } = deps;

  return {
    socket,
    playerId,
    accountId,
    username,
    sessionPlayer,
    getLobbyForSocket,
    withLobbyFromSocket,
    withLobbyPlayer,
    broadcastLobbyUpdate,
    findSocketByPlayerId,
    savePlayerData,
    isDebugScenarioAllowed,
    applyDebugScenario,
    softDisconnectPlayerFromLobby,
  };
}

module.exports = { createSocketHandlerCtx };
