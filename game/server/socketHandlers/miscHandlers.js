const lobbies = require('../lobbies');

/**
 * Debug scenarios, heartbeat, and disconnect cleanup.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('./ctx').SocketContext} ctx
 */
function register(socket, ctx) {
  const {
    getLobbyForSocket,
    isDebugScenarioAllowed,
    applyDebugScenario,
    softDisconnectPlayerFromLobby,
  } = ctx;

  socket.on('debugScenario', (data) => {
    const name = data && typeof data.name === 'string' ? data.name : '';
    if (!isDebugScenarioAllowed(socket)) {
      socket.emit('debugScenarioResult', { ok: false, reason: 'Debug scenarios are disabled' });
      return;
    }

    const result = applyDebugScenario(socket, name);
    socket.emit('debugScenarioResult', result);
  });

  socket.on('heartbeat', (data) => {
    if (!data || !Number.isFinite(data.timestamp)) {
      console.warn(`Rejected heartbeat from ${socket.id}: invalid payload`);
      return;
    }
    const lobby = getLobbyForSocket(socket);
    if (lobby && lobby.state.players[socket.playerId]) {
      lobby.state.players[socket.playerId].lastActivity = Date.now();
    }
    socket.emit('heartbeat_ack', { latency: Date.now() - data.timestamp });
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
