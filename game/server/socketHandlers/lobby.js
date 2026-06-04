function register(socket, ctx) {
  const {
    playerId,
    accountId,
    username,
    sessionPlayer,
    lobbies,
    joinPlayerToLobby,
    reconnectPlayerToLobby,
    leaveLobbyForSocket,
    softDisconnectPlayerFromLobby,
    applyLayoutForQuest,
    ensureShopOffer,
    withLobbyContext,
  } = ctx;

  socket.on('listLobbies', () => {
    socket.emit('lobbyListUpdate', { lobbies: lobbies.listLobbySummaries() });
  });

  socket.on('createLobby', (data) => {
    if (lobbies.getLobbyForPlayer(playerId)) {
      socket.emit('lobbyError', { reason: 'Already in a lobby' });
      return;
    }
    const lobby = lobbies.createLobby(playerId, data && data.name);
    withLobbyContext(lobby, () => {
      applyLayoutForQuest(lobby.state, lobby.state.selectedQuestId);
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
    joinPlayerToLobby(socket, lobby);
  });

  socket.on('leaveLobby', () => {
    if (!lobbies.getLobbyForPlayer(playerId)) {
      socket.emit('lobbyError', { reason: 'Not in a lobby' });
      return;
    }
    leaveLobbyForSocket(socket);
    const session = lobbies.getSession(playerId) || {
      playerId,
      accountId,
      username,
      selectedDeck: sessionPlayer.selectedDeck,
      inventory: sessionPlayer.inventory,
      ownedCards: sessionPlayer.ownedCards,
      currency: sessionPlayer.currency,
    };
    lobbies.registerSession(playerId, session);
    socket.emit('lobbyLeft', {
      lobbies: lobbies.listLobbySummaries(),
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
