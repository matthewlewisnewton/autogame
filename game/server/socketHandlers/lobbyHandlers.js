// ── Lobby Socket Handlers ──
// Per-event register*(socket, ctx) functions; wired from index.js via
// registerLobbyHandlers(socket, ctx) after the connection preamble.
//
// Expected ctx fields (connection identity):
//   playerId, accountId, username, sessionPlayer, socket, io, lobbies
//
// Index-local helpers (for current and later sub-tickets):
//   withLobbyContext, withLobbyFromSocket, withLobbyPlayer, getLobbyForSocket,
//   broadcastLobbyList, applyLayoutForQuest, ensureShopOffer, joinPlayerToLobby,
//   joinLobbyWithPhasePolicy, reconnectPlayerToLobby, leaveLobbyForSocket,
//   buildSessionFromPlayer
//
// This module must NOT require('./index') (circular). Use ctx or leaf modules.

const { getUnlockedKeyItems } = require('../progression');

function registerListLobbies(socket, ctx) {
  socket.on('listLobbies', () => {
    socket.emit('lobbyListUpdate', { lobbies: ctx.lobbies.listLobbySummaries() });
  });
}

function registerListKeyItems(socket, ctx) {
  socket.on('listKeyItems', () => {
    const items = getUnlockedKeyItems().map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      cooldownMs: def.cooldownMs,
    }));
    socket.emit('keyItemsListed', { items });
  });
}

function registerCreateLobby(socket, ctx) {
  socket.on('createLobby', (data) => {
    if (ctx.lobbies.getLobbyForPlayer(ctx.playerId)) {
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
}

function registerJoinLobby(socket, ctx) {
  socket.on('joinLobby', (data) => {
    const existingLobby = ctx.lobbies.getLobbyForPlayer(ctx.playerId);
    if (existingLobby) {
      const lobbyId = data && typeof data.lobbyId === 'string' ? data.lobbyId : null;
      const player = existingLobby.state.players[ctx.playerId];
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
}

function registerLeaveLobby(socket, ctx) {
  socket.on('leaveLobby', () => {
    if (!ctx.lobbies.getLobbyForPlayer(ctx.playerId)) {
      socket.emit('lobbyError', { reason: 'Not in a lobby' });
      return;
    }
    ctx.leaveLobbyForSocket(socket);
    const session =
      ctx.lobbies.getSession(ctx.playerId) || ctx.buildSessionFromPlayer(ctx.sessionPlayer);
    ctx.lobbies.registerSession(ctx.playerId, session);
    socket.emit('lobbyLeft', {
      lobbies: ctx.lobbies.listLobbySummaries(),
    });
  });
}

function registerLobbyHandlers(socket, ctx) {
  registerListLobbies(socket, ctx);
  registerListKeyItems(socket, ctx);
  registerCreateLobby(socket, ctx);
  registerJoinLobby(socket, ctx);
  registerLeaveLobby(socket, ctx);
}

module.exports = {
  registerLobbyHandlers,
  registerListLobbies,
  registerListKeyItems,
  registerCreateLobby,
  registerJoinLobby,
  registerLeaveLobby,
};
