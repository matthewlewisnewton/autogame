/**
 * Lobby browser/join/leave socket handlers.
 * Behavior matches the pre-refactor inline handlers in index.js.
 */

function register(socket, ctx) {
  const { playerId, sessionPlayer } = ctx;

  socket.on('listLobbies', () => {
    socket.emit('lobbyListUpdate', { lobbies: ctx.lobbies.listLobbySummaries() });
  });

  socket.on('createLobby', (data) => {
    if (ctx.lobbies.getLobbyForPlayer(playerId)) {
      socket.emit('lobbyError', { reason: 'Already in a lobby' });
      return;
    }
    const lobby = ctx.lobbies.createLobby(data && data.name);
    ctx.withLobbyContext(lobby, () => {
      ctx.applyLayoutForQuest(lobby.state, lobby.state.selectedQuestId);
      ctx.ensureShopOffer();
    });
    ctx.joinPlayerToLobby(socket, lobby);
  });

  socket.on('joinLobby', (data) => {
    const existingLobby = ctx.lobbies.getLobbyForPlayer(playerId);
    if (existingLobby) {
      const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
      const player = existingLobby.state.players[playerId];
      if (player && player.connected === false && lobbyId === existingLobby.id) {
        ctx.reconnectPlayerToLobby(socket, existingLobby);
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
    const lobby = ctx.lobbies.getLobbyById(lobbyId);
    if (!lobby) {
      socket.emit('lobbyError', { reason: 'Lobby not found' });
      return;
    }
    ctx.joinLobbyWithPhasePolicy(socket, lobby);
  });

  socket.on('leaveLobby', () => {
    if (!ctx.lobbies.getLobbyForPlayer(playerId)) {
      socket.emit('lobbyError', { reason: 'Not in a lobby' });
      return;
    }
    ctx.leaveLobbyForSocket(socket);
    const session = ctx.lobbies.getSession(playerId) || ctx.buildSessionFromPlayer(sessionPlayer);
    ctx.lobbies.registerSession(playerId, session);
    socket.emit('lobbyLeft', {
      lobbies: ctx.lobbies.listLobbySummaries(),
    });
  });
}

module.exports = { register };
