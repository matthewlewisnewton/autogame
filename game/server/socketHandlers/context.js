// Shared socket-handler context — dependencies are passed from index.js to avoid
// require('./index') circular imports (same pattern as cardEffects.js).

function buildSocketContext(socket, identity, helpers) {
  const { playerId, accountId, username, sessionPlayer } = identity;
  const {
    withLobbyFromSocket,
    broadcastLobbyUpdate,
    findSocketByPlayerId,
    savePlayerData,
    io,
    lobbies,
    joinPlayerToLobby,
    reconnectPlayerToLobby,
    leaveLobbyForSocket,
    softDisconnectPlayerFromLobby,
    applyLayoutForQuest,
    ensureShopOffer,
    withLobbyContext,
    broadcastLobbyList,
    getLobbyForSocket,
    isDebugScenarioAllowed,
    applyDebugScenario,
  } = helpers;

  return {
    socket,
    playerId,
    accountId,
    username,
    sessionPlayer,
    withLobbyFromSocket,
    broadcastLobbyUpdate,
    findSocketByPlayerId,
    savePlayerData,
    io,
    lobbies,
    joinPlayerToLobby,
    reconnectPlayerToLobby,
    leaveLobbyForSocket,
    softDisconnectPlayerFromLobby,
    applyLayoutForQuest,
    ensureShopOffer,
    withLobbyContext,
    broadcastLobbyList,
    getLobbyForSocket,
    isDebugScenarioAllowed,
    applyDebugScenario,
  };
}

module.exports = { buildSocketContext };
