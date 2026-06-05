// ── Run Socket Handlers ──
// Registers run-lifecycle socket.on handlers extracted from lobbyHandlers.js.

const { isPlayingPhase } = require('../lobbies');
const { savePlayerData } = require('../progression');

function register(socket, ctx) {
  const {
    withLobbyFromSocket,
    returnPlayersToLobby,
    giveUpRun,
    abandonSuspendedRun,
    claimCardReward,
  } = ctx;

  socket.on('returnToLobby', () => {
    withLobbyFromSocket(socket, (state) => {
    if (state.run && state.run.status === 'playing') {
      socket.emit('runError', { reason: 'Run still in progress' });
      return;
    }

    if (!state.run) return;

    returnPlayersToLobby(state);
    });
  });

  socket.on('giveUp', () => {
    withLobbyFromSocket(socket, (state) => {
      try {
        if (!isPlayingPhase(state) || !state.run || state.run.status === 'suspended') {
          socket.emit('runError', { reason: 'No active run' });
          return;
        }
        const result = giveUpRun(state);
        if (!result.ok) {
          socket.emit('runError', { reason: result.reason || 'Cannot give up' });
          return;
        }
        socket.emit('runAbandoned');
      } catch (err) {
        console.error('[giveUp] failed:', err);
        socket.emit('runError', { reason: 'Give up failed' });
      }
    });
  });

  socket.on('abandonRun', () => {
    withLobbyFromSocket(socket, (state) => {
      if (!state.suspendedCheckpoint) {
        socket.emit('runError', { reason: 'No suspended expedition' });
        return;
      }
      abandonSuspendedRun(state);
    });
  });

  socket.on('claimCardReward', (data) => {
    withLobbyFromSocket(socket, (state) => {
    const player = state.players[socket.playerId];
    if (!player) return;
    if (!state.run || state.run.status === 'playing') return;
    if (!data || typeof data.cardId !== 'string') return;

    const result = claimCardReward(socket.playerId, data.cardId, state);
    if (!result.ok) return;

    savePlayerData(socket.playerId);
    socket.emit('cardRewardClaimed', {
      cardId: result.cardId,
      ownedCards: result.ownedCards,
      inventory: result.inventory,
    });
    });
  });
}

module.exports = { register };
