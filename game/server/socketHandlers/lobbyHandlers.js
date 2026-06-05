// ── Lobby Socket Handlers ──
// Registers lobby-browser and run-lifecycle socket.on handlers that previously
// lived inline in the io.on('connection') closure in index.js.
//
// ── Circular-dependency resolution ──
// This module must NOT require('./index') (circular). Per-connection identity
// and index.js-local helpers are supplied via the ctx object passed to
// register(socket, ctx) from the connection handler.

function register(socket, ctx) {
  const { lobbies } = ctx;

  socket.on('listLobbies', () => {
    socket.emit('lobbyListUpdate', { lobbies: lobbies.listLobbySummaries() });
  });
}

module.exports = { register };
