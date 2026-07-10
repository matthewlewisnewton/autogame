const crypto = require('crypto');
const { createGameState } = require('./game-state');
const { createEmptyHubPresence } = require('./hubPresence');
const { registerLobby, unregisterLobby } = require('./lobbyRegistry');

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
// Lobby membership transitions contain async persistence reads. Serialize them
// so create/join checks and their eventual commits are one atomic operation.
let membershipQueue = Promise.resolve();

function withMembershipLock(fn) {
  const operation = membershipQueue.then(fn, fn);
  membershipQueue = operation.catch(() => {});
  return operation;
}

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

/**
 * Number of players in a lobby that are still connected. Records with
 * `connected === false` (inside the disconnect grace window, but no longer
 * present) do not count, so a lobby whose only players have dropped reports 0.
 */
function connectedPlayerCount(lobby) {
  return Object.values(lobby.state.players).filter((p) => p.connected !== false).length;
}

function lobbySummary(lobby) {
  return {
    id: lobby.id,
    name: lobby.name,
    gamePhase: lobby.state.gamePhase,
    selectedQuestId: lobby.state.selectedQuestId,
    selectedQuestTier: lobby.state.selectedQuestTier ?? 1,
    // Advertise the connected count, not raw records, so the browser never shows
    // a lobby whose players have all disconnected as "0 player(s) · Drop In".
    playerCount: connectedPlayerCount(lobby),
    players: lobbyPlayerSummaries(lobby),
  };
}

function listLobbySummaries() {
  // Exclude ghost lobbies (zero connected players) so they are never advertised
  // as joinable, even in the window before the reaper deletes them.
  return Array.from(lobbies.values())
    .filter((lobby) => connectedPlayerCount(lobby) > 0)
    .map(lobbySummary);
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
  registerLobby(id).catch((err) => {
    console.error('[lobbyRegistry] registerLobby failed:', err);
  });
  return lobby;
}

function deleteLobbyIfEmpty(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby || Object.keys(lobby.state.players).length > 0) return false;
  lobbies.delete(lobbyId);
  unregisterLobby(lobbyId).catch((err) => {
    console.error('[lobbyRegistry] unregisterLobby failed:', err);
  });
  return true;
}

function assignPlayerToLobby(playerId, lobbyId) {
  playerLobby.set(playerId, lobbyId);
  // A player joining/reconnecting means the lobby is no longer abandoned; clear
  // any pending empty-since stamp so the reaper does not evict it.
  const lobby = lobbies.get(lobbyId);
  if (lobby && lobby.emptySince) delete lobby.emptySince;
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
    unregisterLobby(lobbyId).catch((err) => {
      console.error('[lobbyRegistry] unregisterLobby failed:', err);
    });
    lobbies.delete(lobbyId);
    return { lobby, deleted: true };
  }

  return { lobby, deleted: false };
}

function resetAllLobbies() {
  lobbies.clear();
  playerLobby.clear();
  playerSessions.clear();
  membershipQueue = Promise.resolve();
}

function getPrimaryLobbyStateForTests() {
  // Prefer a lobby with connected players. Ghost lobbies (all records disconnected,
  // waiting for the reaper TTL) remain in the registry but must not shadow the live
  // lobby that socket integration tests attach to.
  for (const lobby of lobbies.values()) {
    if (connectedPlayerCount(lobby) > 0) return lobby.state;
  }
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
  deleteLobbyIfEmpty,
  withMembershipLock,
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
  connectedPlayerCount,
  resetAllLobbies,
  getPrimaryLobbyStateForTests,
  _lobbies: lobbies,
  _playerLobby: playerLobby,
};
