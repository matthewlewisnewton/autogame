const lobbies = require('../lobbies');
const { isLobbyPhase } = lobbies;
const { isValidQuestId, buildQuestUpdatePayload } = require('../quests');
const {
  ensureShopOffer,
  assignRunSpawnPositions,
  stateSnapshot,
  checkAllReady,
  validateDeck,
  normalizePlayerInventory,
} = require('../progression');

/**
 * Lobby browser and squad-management socket events.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('./ctx').SocketContext} ctx
 */
function register(socket, ctx) {
  const {
    playerId,
    sessionPlayer,
    withLobbyContext,
    withLobbyPlayer,
    broadcastLobbyUpdate,
    joinPlayerToLobby,
    joinLobbyWithPhasePolicy,
    leaveLobbyForSocket,
    reconnectPlayerToLobby,
    applyLayoutForQuest,
    buildSessionFromPlayer,
    io,
  } = ctx;

  socket.on('listLobbies', () => {
    socket.emit('lobbyListUpdate', { lobbies: lobbies.listLobbySummaries() });
  });

  socket.on('createLobby', (data) => {
    if (lobbies.getLobbyForPlayer(playerId)) {
      socket.emit('lobbyError', { reason: 'Already in a lobby' });
      return;
    }
    const lobby = lobbies.createLobby(data && data.name);
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
    joinLobbyWithPhasePolicy(socket, lobby);
  });

  socket.on('leaveLobby', () => {
    if (!lobbies.getLobbyForPlayer(playerId)) {
      socket.emit('lobbyError', { reason: 'Not in a lobby' });
      return;
    }
    leaveLobbyForSocket(socket);
    const session = lobbies.getSession(playerId) || buildSessionFromPlayer(sessionPlayer);
    lobbies.registerSession(playerId, session);
    socket.emit('lobbyLeft', {
      lobbies: lobbies.listLobbySummaries(),
    });
  });

  socket.on('selectQuest', (data) => {
    withLobbyPlayer(socket, { requirePhase: 'lobby' }, (state, lobby, _player) => {
      if (state.suspendedCheckpoint) {
        socket.emit('questError', { reason: 'Abandon the suspended expedition before changing quests' });
        return;
      }

      const questId = data && typeof data.questId === 'string' ? data.questId : null;
      if (!questId) {
        socket.emit('questError', { reason: 'Missing questId' });
        return;
      }

      if (!isValidQuestId(questId)) {
        socket.emit('questError', { reason: `Unknown quest: ${questId}` });
        return;
      }

      state.selectedQuestId = questId;
      applyLayoutForQuest(state, questId);
      assignRunSpawnPositions(Object.values(state.players));
      const payload = {
        ...buildQuestUpdatePayload(state),
        layoutSeed: state.layoutSeed,
        layout: state.layout,
      };
      io.to(lobby.id).emit('questUpdate', payload);
      io.to(lobby.id).emit('stateUpdate', stateSnapshot());
      broadcastLobbyUpdate(lobby);
    });
  });

  socket.on('playerReady', (ready) => {
    withLobbyPlayer(socket, {}, (state, lobby, player) => {
      if (ready) {
        normalizePlayerInventory(player);
        const result = validateDeck(player.selectedDeck, player.inventory);
        if (!result.valid) {
          player.ready = false;
          socket.emit('deckError', { reason: result.reason });
          broadcastLobbyUpdate(lobby);
          return;
        }
      }

      player.ready = !!ready;
      broadcastLobbyUpdate(lobby);
      if (isLobbyPhase(state)) {
        checkAllReady();
      }
    });
  });
}

module.exports = { register };
