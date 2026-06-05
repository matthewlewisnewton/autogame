/**
 * Per-lobby hub presence store for lobby-phase player positions and cosmetics.
 * `viewerPlayerId` on payload builders is reserved for future AOI culling.
 */

function createEmptyHubPresence() {
  return { revision: 0, players: {} };
}

/**
 * @param {{ id: string, x?: number, y?: number, z?: number, rotation?: number, cosmetic?: object, username?: string }} player
 */
function buildHubPresenceEntry(player) {
  return {
    playerId: player.id,
    x: player.x,
    y: player.y,
    z: player.z,
    rotation: player.rotation,
    cosmetic: player.cosmetic,
    username: player.username,
  };
}

function presenceEntriesEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.playerId === b.playerId &&
    a.x === b.x &&
    a.y === b.y &&
    a.z === b.z &&
    a.rotation === b.rotation &&
    a.username === b.username &&
    JSON.stringify(a.cosmetic) === JSON.stringify(b.cosmetic)
  );
}

function ensureHubPresence(lobby) {
  if (!lobby.hubPresence) {
    lobby.hubPresence = createEmptyHubPresence();
  }
  return lobby.hubPresence;
}

/**
 * @param {{ state: { players: Record<string, object> }, hubPresence?: { revision: number, players: Record<string, object> } }} lobby
 * @param {string} playerId
 * @returns {boolean} whether revision was bumped
 */
function syncHubPresencePlayer(lobby, playerId) {
  const player = lobby.state.players[playerId];
  if (!player) return false;

  const hubPresence = ensureHubPresence(lobby);
  const next = buildHubPresenceEntry(player);
  const prev = hubPresence.players[playerId];

  if (prev && presenceEntriesEqual(prev, next)) {
    return false;
  }

  hubPresence.players[playerId] = next;
  hubPresence.revision += 1;
  return true;
}

/**
 * @param {{ hubPresence?: { revision: number, players: Record<string, object> } }} lobby
 * @param {string} playerId
 * @returns {boolean} whether revision was bumped
 */
function removeHubPresencePlayer(lobby, playerId) {
  const hubPresence = lobby.hubPresence;
  if (!hubPresence?.players[playerId]) {
    return false;
  }

  delete hubPresence.players[playerId];
  hubPresence.revision += 1;
  return true;
}

/**
 * @param {{ id: string, hubPresence?: { revision: number, players: Record<string, object> } }} lobby
 * @param {string} viewerPlayerId
 */
function buildHubPresencePayload(lobby, viewerPlayerId) {
  void viewerPlayerId;
  const hubPresence = lobby.hubPresence ?? createEmptyHubPresence();
  return {
    lobbyId: lobby.id,
    revision: hubPresence.revision,
    players: { ...hubPresence.players },
  };
}

/**
 * Emit `hubPresenceUpdate` to every socket in the lobby room.
 * @param {import('socket.io').Server} io
 * @param {{ id: string, hubPresence?: { revision: number, players: Record<string, object> } }} lobby
 */
function broadcastHubPresence(io, lobby) {
  if (!lobby?.id) return;
  const payload = buildHubPresencePayload(lobby, null);
  io.to(lobby.id).emit('hubPresenceUpdate', payload);
}

module.exports = {
  createEmptyHubPresence,
  buildHubPresenceEntry,
  syncHubPresencePlayer,
  removeHubPresencePlayer,
  buildHubPresencePayload,
  broadcastHubPresence,
};
