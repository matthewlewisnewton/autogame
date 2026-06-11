const crypto = require('crypto');
const { createGameState } = require('./game-state');
const { createEmptyHubPresence } = require('./hubPresence');

/** @typedef {import('./index').GameState} GameState */

/**
 * Canonical lobby `gamePhase` values.
 *
 * Run suspend/resume uses `run.status === 'suspended'` while `gamePhase` remains
 * `lobby` — there is no separate suspended phase string.
 */
const PHASES = Object.freeze({
  LOBBY: 'lobby',
  PLAYING: 'playing',
});

const KNOWN_PHASES = new Set(Object.values(PHASES));

function isKnownPhase(phase) {
  return KNOWN_PHASES.has(phase);
}

/**
 * @param {{ gamePhase?: string }} state
 * @returns {boolean}
 */
function isLobbyPhase(state) {
  return state?.gamePhase === PHASES.LOBBY;
}

/**
 * @param {{ gamePhase?: string }} state
 * @returns {boolean}
 */
function isPlayingPhase(state) {
  return state?.gamePhase === PHASES.PLAYING;
}

/**
 * @param {{ run?: { status?: string } }} state
 * @returns {boolean}
 */
function isActiveRun(state) {
  const run = state?.run;
  if (!run) return true;
  return run.status === 'playing';
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function canTransition(from, to) {
  if (!isKnownPhase(from) || !isKnownPhase(to)) {
    return false;
  }
  if (from === to) {
    return true;
  }
  return (
    (from === PHASES.LOBBY && to === PHASES.PLAYING) ||
    (from === PHASES.PLAYING && to === PHASES.LOBBY)
  );
}

/**
 * @param {{ state: { gamePhase: string } }} lobby
 * @param {string} nextPhase
 * @returns {boolean}
 */
function setPhase(lobby, nextPhase) {
  if (!lobby?.state) {
    throw new Error('setPhase: lobby must have state');
  }
  if (!isKnownPhase(nextPhase)) {
    throw new Error(
      `setPhase: unknown phase "${nextPhase}" (expected ${[...KNOWN_PHASES].join(' or ')})`,
    );
  }
  const from = lobby.state.gamePhase;
  if (!canTransition(from, nextPhase)) {
    throw new Error(`setPhase: illegal transition from "${from}" to "${nextPhase}"`);
  }
  lobby.state.gamePhase = nextPhase;
  return true;
}

/**
 * @param {{ gamePhase?: string, _lobbyId?: string }} state
 * @param {string} nextPhase
 * @returns {boolean}
 */
function resolveLobbyForState(state) {
  if (!state) return null;
  if (state._lobbyId) {
    const lobby = lobbies.get(state._lobbyId);
    if (lobby) return lobby;
  }
  for (const lobby of lobbies.values()) {
    if (lobby.state === state) return lobby;
  }
  return null;
}

/**
 * Route a phase write when only lobby {@link GameState} is in scope (e.g. progression
 * inside `withLobbyContext`). Resolves the lobby via `_lobbyId` or state identity.
 *
 * @param {{ gamePhase?: string, _lobbyId?: string }} state
 * @param {string} nextPhase
 * @returns {boolean}
 */
function setGamePhase(state, nextPhase) {
  if (!state) {
    throw new Error('setGamePhase: state is required');
  }
  const lobby = resolveLobbyForState(state);
  return setPhase(lobby ?? { state }, nextPhase);
}

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
    gamePhase: lobby.state.gamePhase,
    selectedQuestId: lobby.state.selectedQuestId,
    selectedQuestTier: lobby.state.selectedQuestTier ?? 1,
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

function createLobby(name) {
  const id = generateLobbyId();
  const lobby = {
    id,
    name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 48) : `Lobby ${id}`,
    state: createLobbyGameState(),
    hubPresence: createEmptyHubPresence(),
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
  // pendingTrades is keyed by tradeId, not playerId — scan for trades involving the player
  for (const [tradeId, trade] of Object.entries(lobby.state.pendingTrades || {})) {
    if (trade.fromPlayerId === playerId || trade.toPlayerId === playerId) {
      delete lobby.state.pendingTrades[tradeId];
    }
  }

  const remaining = Object.keys(lobby.state.players).length;
  if (remaining === 0) {
    lobbies.delete(lobbyId);
    return { lobby, deleted: true };
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
  PHASES,
  isLobbyPhase,
  isPlayingPhase,
  isActiveRun,
  canTransition,
  setPhase,
  setGamePhase,
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
