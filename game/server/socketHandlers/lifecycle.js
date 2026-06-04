/**
 * Connection lifecycle socket handlers (disconnect, heartbeat).
 * Behavior matches the pre-refactor inline handlers in index.js.
 */

function register(socket, ctx) {
  socket.on('heartbeat', (data) => {
    if (!data || !Number.isFinite(data.timestamp)) {
      console.warn(`Rejected heartbeat from ${socket.id}: invalid payload`);
      return;
    }
    const lobby = ctx.getLobbyForSocket(socket);
    if (lobby && lobby.state.players[socket.playerId]) {
      lobby.state.players[socket.playerId].lastActivity = Date.now();
    }
    socket.emit('heartbeat_ack', { latency: Date.now() - data.timestamp });
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    if (!socket.playerId) return;

    const lobby = ctx.getLobbyForPlayer(socket.playerId);
    if (lobby && lobby.state.players[socket.playerId]) {
      ctx.softDisconnectPlayerFromLobby(socket);
      return;
    }

    ctx.removeSession(socket.playerId);
  });
}

module.exports = { register };
