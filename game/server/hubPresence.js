const { backfillCosmetic } = require('./cosmetic');

/** Matches {@link import('./lobbies').PHASES.LOBBY} — inlined to avoid a circular require with lobbies.js. */
const LOBBY_PHASE = 'lobby';

function createEmptyHubPresence() {
  return { schemaVersion: 1, entries: {}, revision: 0 };
}

/**
 * Build a slim hub-presence entry from a live player record.
 * @param {object} player
 */
function buildHubPresenceEntry(player) {
  return {
    id: player.id,
    x: player.x ?? 0,
    y: player.y ?? 0,
    z: player.z ?? 0,
    rotation: Number.isFinite(player.rotation) ? player.rotation : 0,
    cosmetic: backfillCosmetic(player.cosmetic),
    username: player.username || player.id,
    connected: player.connected !== false,
  };
}

/**
 * Rebuild `lobby.hubPresence.entries` from lobby-phase players.
 * Skips disconnected players (`connected === false`); ghosts are not kept.
 * Bumps `lobby.hubPresence.revision` when the entry map changes.
 */
function syncHubPresenceFromLobby(lobby) {
  if (!lobby?.hubPresence) return;
  const prevJson = JSON.stringify(lobby.hubPresence.entries);
  const entries = {};
  if (lobby.state?.gamePhase === LOBBY_PHASE) {
    for (const player of Object.values(lobby.state.players)) {
      if (!player || player.connected === false) continue;
      entries[player.id] = buildHubPresenceEntry(player);
    }
  }
  lobby.hubPresence.entries = entries;
  if (prevJson !== JSON.stringify(entries)) {
    lobby.hubPresence.revision = (lobby.hubPresence.revision ?? 0) + 1;
  }
}

/**
 * JSON-safe clone of hub presence for emits and tests.
 * @param {{ hubPresence?: { schemaVersion: number, entries: object, revision?: number } }} lobby
 */
function getHubPresenceSnapshot(lobby) {
  const source = lobby?.hubPresence ?? createEmptyHubPresence();
  return JSON.parse(JSON.stringify(source));
}

/**
 * @param {import('socket.io').Server} io
 * @param {{ id: string, state: { gamePhase: string }, hubPresence: object }} lobby
 * @param {{ removedPlayerIds?: string[], excludeSocketId?: string }} [opts]
 */
function emitHubPresenceUpdate(io, lobby, opts = {}) {
  if (lobby.state?.gamePhase !== LOBBY_PHASE) return;

  const payload = {
    lobbyId: lobby.id,
    presence: getHubPresenceSnapshot(lobby),
  };
  if (opts.removedPlayerIds?.length) {
    payload.removedPlayerIds = opts.removedPlayerIds;
  }

  const room = io.to(lobby.id);
  const target = opts.excludeSocketId ? room.except(opts.excludeSocketId) : room;
  target.emit('hubPresenceUpdate', payload);
  lobby._lastHubPresenceEmitRevision = lobby.hubPresence.revision;
}

/**
 * Emit a lobby-scoped snapshot when sync bumped `revision` since the last emit.
 * @param {import('socket.io').Server} io
 * @param {object} lobby
 */
function emitHubPresenceUpdateIfChanged(io, lobby) {
  if (lobby.state?.gamePhase !== LOBBY_PHASE) return;
  if (lobby.hubPresence.revision === lobby._lastHubPresenceEmitRevision) return;
  emitHubPresenceUpdate(io, lobby);
}

module.exports = {
  createEmptyHubPresence,
  buildHubPresenceEntry,
  syncHubPresenceFromLobby,
  getHubPresenceSnapshot,
  emitHubPresenceUpdate,
  emitHubPresenceUpdateIfChanged,
};
