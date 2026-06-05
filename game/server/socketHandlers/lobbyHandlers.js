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

function registerLobbyHandlers(socket, ctx) {
  registerListLobbies(socket, ctx);
  registerListKeyItems(socket, ctx);
}

module.exports = {
  registerLobbyHandlers,
  registerListLobbies,
  registerListKeyItems,
};
