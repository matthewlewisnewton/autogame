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
    io,
    getLobbyForSocket,
    withLobbyFromSocket,
    withLobbyPlayer,
    withLobbyContext,
    broadcastLobbyUpdate,
    findSocketByPlayerId,
    savePlayerData,
    isDebugScenarioAllowed,
    applyDebugScenario,
    softDisconnectPlayerFromLobby,
    joinPlayerToLobby,
    joinLobbyWithPhasePolicy,
    reconnectPlayerToLobby,
    leaveLobbyForSocket,
    buildSessionFromPlayer,
    applyLayoutForQuest,
  } = deps;

  return {
    socket,
    playerId,
    accountId,
    username,
    sessionPlayer,
    io,
    getLobbyForSocket,
    withLobbyFromSocket,
    withLobbyPlayer,
    withLobbyContext,
    broadcastLobbyUpdate,
    findSocketByPlayerId,
    savePlayerData,
    isDebugScenarioAllowed,
    applyDebugScenario,
    softDisconnectPlayerFromLobby,
    joinPlayerToLobby,
    joinLobbyWithPhasePolicy,
    reconnectPlayerToLobby,
    leaveLobbyForSocket,
    buildSessionFromPlayer,
    applyLayoutForQuest,
  };
}

module.exports = { createSocketHandlerCtx };
