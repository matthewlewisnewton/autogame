const { backfillCosmetic } = require('./cosmetic');

/** Matches {@link import('./lobbies').PHASES.LOBBY} — inlined to avoid a circular require with lobbies.js. */
const LOBBY_PHASE = 'lobby';

function createEmptyHubPresence() {
  return { schemaVersion: 1, entries: {} };
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
 */
function syncHubPresenceFromLobby(lobby) {
  if (!lobby?.hubPresence) return;
  const entries = {};
  if (lobby.state?.gamePhase === LOBBY_PHASE) {
    for (const player of Object.values(lobby.state.players)) {
      if (!player || player.connected === false) continue;
      entries[player.id] = buildHubPresenceEntry(player);
    }
  }
  lobby.hubPresence.entries = entries;
}

/**
 * JSON-safe clone of hub presence for emits and tests.
 * @param {{ hubPresence?: { schemaVersion: number, entries: object } }} lobby
 */
function getHubPresenceSnapshot(lobby) {
  const source = lobby?.hubPresence ?? createEmptyHubPresence();
  return JSON.parse(JSON.stringify(source));
}

module.exports = {
  createEmptyHubPresence,
  buildHubPresenceEntry,
  syncHubPresenceFromLobby,
  getHubPresenceSnapshot,
};
