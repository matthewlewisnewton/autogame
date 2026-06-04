const crypto = require('crypto');
const { createGameState } = require('./game-state');

/** @typedef {import('./index').GameState} GameState */

// Alias: lobby-created state uses the same canonical factory as the module-level
// singleton in index.js.  The previous local definition lacked `enchantments`,
// `lobby`, and `_pendingVolatileExplosions`, causing latent `undefined` errors
// when lobby state entered combat code paths.
const createLobbyGameState = createGameState;

const lobbies = new Map();
/** @type {Map<string, string>} playerId -> lobbyId */
const playerLobby = new Map();
/** @type {Map<string, object>} playerId -> session data while browsing (not in a lobby) */
const playerSessions = new Map();

function generateLobbyId() {
  return crypto.randomBytes(4).toString('hex');
}

function lobbyPlayerSummaries(lobby) {
  return Object.entries(lobby.state.players).map(([id, p]) => ({
    id,
    username: p.username || id,
    ready: !!p.ready,
  }));
}

function lobbySummary(lobby) {
  return {
    id: lobby.id,
    name: lobby.name,
    hostId: lobby.hostId,
    gamePhase: lobby.state.gamePhase,
    selectedQuestId: lobby.state.selectedQuestId,
    playerCount: Object.keys(lobby.state.players).length,
    players: lobbyPlayerSummaries(lobby),
  };
}

function listLobbySummaries() {
  return Array.from(lobbies.values()).map(lobbySummary);
}

function getLobbyById(lobbyId) {
  return lobbies.get(lobbyId) || null;
}

function getLobbyForPlayer(playerId) {
  const lobbyId = playerLobby.get(playerId);
  if (!lobbyId) return null;
  return lobbies.get(lobbyId) || null;
}

function registerSession(playerId, session) {
  playerSessions.set(playerId, session);
}

function getSession(playerId) {
  return playerSessions.get(playerId) || null;
}

function getSessionCount() {
  return playerSessions.size;
}

function removeSession(playerId) {
  playerSessions.delete(playerId);
}

function createLobby(hostId, name) {
  const id = generateLobbyId();
  const lobby = {
    id,
    name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 48) : `Lobby ${id}`,
    hostId,
    state: createLobbyGameState(),
    createdAt: Date.now(),
  };
  lobbies.set(id, lobby);
  lobby.state._lobbyId = id;
  return lobby;
}

function assignPlayerToLobby(playerId, lobbyId) {
  playerLobby.set(playerId, lobbyId);
}

function removePlayerFromLobby(playerId) {
  const lobbyId = playerLobby.get(playerId);
  if (!lobbyId) return null;

  playerLobby.delete(playerId);
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;

  delete lobby.state.players[playerId];
  lobby.state.minions = lobby.state.minions.filter((m) => m.ownerId !== playerId);
  delete lobby.state.pendingTrades[playerId];

  const remaining = Object.keys(lobby.state.players).length;
  if (remaining === 0) {
    lobbies.delete(lobbyId);
    return { lobby, deleted: true };
  }

  if (lobby.hostId === playerId) {
    // No hostChanged event — clients re-derive hostId from lobbyListUpdate / lobbyJoined snapshots.
    lobby.hostId = Object.keys(lobby.state.players)[0];
  }

  return { lobby, deleted: false };
}

function resetAllLobbies() {
  lobbies.clear();
  playerLobby.clear();
  playerSessions.clear();
}

function getPrimaryLobbyStateForTests() {
  const first = lobbies.values().next().value;
  return first ? first.state : null;
}

module.exports = {
  createLobbyGameState,
  createLobby,
  assignPlayerToLobby,
  removePlayerFromLobby,
  getLobbyById,
  getLobbyForPlayer,
  registerSession,
  getSession,
  getSessionCount,
  removeSession,
  listLobbySummaries,
  lobbySummary,
  lobbyPlayerSummaries,
  resetAllLobbies,
  getPrimaryLobbyStateForTests,
  _lobbies: lobbies,
  _playerLobby: playerLobby,
};
