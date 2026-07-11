const { SERVER_TO_CLIENT } = require('../shared/events.js');
const { backfillCosmetic } = require('./cosmetic');

/** Matches {@link import('./lobbies').PHASES.LOBBY} — inlined to avoid a circular require with lobbies.js. */
const LOBBY_PHASE = 'lobby';

function createEmptyHubPresence() {
  return { schemaVersion: 1, entries: {}, revision: 0 };
}

function ensureLobbyHubPresence(lobby) {
  if (!lobby) return null;
  if (!lobby.hubPresence) {
    lobby.hubPresence = createEmptyHubPresence();
  }
  return lobby.hubPresence;
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
 * Like {@link buildHubPresenceEntry} but never throws on malformed records.
 * @param {object} player
 */
function safeBuildHubPresenceEntry(player) {
  if (!player || typeof player !== 'object' || !player.id) return null;
  try {
    return buildHubPresenceEntry(player);
  } catch (err) {
    console.error('[hubPresence] failed to build entry for player', player.id, err);
    return null;
  }
}

/**
 * Rebuild `lobby.hubPresence.entries` from lobby-phase players.
 * Skips disconnected players (`connected === false`); ghosts are not kept.
 * Bumps `lobby.hubPresence.revision` when the entry map changes.
 */
function syncHubPresenceFromLobby(lobby) {
  if (!ensureLobbyHubPresence(lobby)) return;
  const prevJson = lobby._hubPresenceEntriesJson
    ?? JSON.stringify(lobby.hubPresence.entries);
  const entries = {};
  const players = lobby.state?.players;
  if (lobby.state?.gamePhase === LOBBY_PHASE && players && typeof players === 'object') {
    for (const player of Object.values(players)) {
      if (!player || player.connected === false) continue;
      const entry = safeBuildHubPresenceEntry(player);
      if (entry) entries[player.id] = entry;
    }
  }
  lobby.hubPresence.entries = entries;
  const nextJson = JSON.stringify(entries);
  lobby._hubPresenceEntriesJson = nextJson;
  if (prevJson !== nextJson) {
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
  if (!ensureLobbyHubPresence(lobby)) return;

  const payload = {
    lobbyId: lobby.id,
    presence: getHubPresenceSnapshot(lobby),
  };
  if (opts.removedPlayerIds?.length) {
    payload.removedPlayerIds = opts.removedPlayerIds;
  }

  const room = io.to(lobby.id);
  let target = opts.excludeSocketId ? room.except(opts.excludeSocketId) : room;
  // Lobby rooms are single-instance; skip Redis adapter fanout when attached.
  const redisAdapterActive = !!(io.sockets?.adapter?.constructor?.name === 'RedisAdapter');
  if (redisAdapterActive && target.local && typeof target.local.emit === 'function') {
    target = target.local;
  }
  target.emit(SERVER_TO_CLIENT.HUB_PRESENCE_UPDATE, payload);
  lobby._lastHubPresenceEmitRevision = lobby.hubPresence.revision;
}

/**
 * Emit a lobby-scoped snapshot when sync bumped `revision` since the last emit.
 * @param {import('socket.io').Server} io
 * @param {object} lobby
 */
function emitHubPresenceUpdateIfChanged(io, lobby) {
  if (lobby.state?.gamePhase !== LOBBY_PHASE) return;
  if (!ensureLobbyHubPresence(lobby)) return;
  if (lobby.hubPresence.revision === lobby._lastHubPresenceEmitRevision) return;
  emitHubPresenceUpdate(io, lobby);
}

/**
 * Sync lobby hub presence and emit when revision changed; logs and swallows errors.
 * @param {import('socket.io').Server} io
 * @param {object} lobby
 */
function syncAndEmitHubPresenceIfChanged(io, lobby) {
  try {
    syncHubPresenceFromLobby(lobby);
    emitHubPresenceUpdateIfChanged(io, lobby);
  } catch (err) {
    console.error('[hubPresence] sync/emit failed for lobby', lobby?.id, err);
  }
}

module.exports = {
  createEmptyHubPresence,
  ensureLobbyHubPresence,
  buildHubPresenceEntry,
  safeBuildHubPresenceEntry,
  syncHubPresenceFromLobby,
  syncAndEmitHubPresenceIfChanged,
  getHubPresenceSnapshot,
  emitHubPresenceUpdate,
  emitHubPresenceUpdateIfChanged,
};
