const { backfillCosmetic } = require('./cosmetic');

/**
 * Ensure the lobby owns a hub-presence registry (sibling to `state`, not global).
 *
 * @param {{ hubPresence?: { players?: object } } | null | undefined} lobby
 */
function ensureHubPresence(lobby) {
  if (!lobby) return;
  if (!lobby.hubPresence) {
    lobby.hubPresence = { players: {} };
    return;
  }
  if (!lobby.hubPresence.players) {
    lobby.hubPresence.players = {};
  }
}

/**
 * @param {object | null | undefined} playerRecord
 * @returns {{ x: number, y: number, z: number, rotation: number, cosmetic: object, username: string }}
 */
function hubPresenceEntryFromPlayer(playerRecord, playerId) {
  return {
    x: playerRecord.x,
    y: playerRecord.y,
    z: playerRecord.z,
    rotation: playerRecord.rotation,
    cosmetic: backfillCosmetic(playerRecord.cosmetic),
    username: playerRecord.username || playerId,
  };
}

/**
 * Upsert one connected member into the lobby-scoped presence registry.
 *
 * @param {{ id?: string, hubPresence?: { players?: object }, state?: { players?: object } } | null | undefined} lobby
 * @param {string | null | undefined} playerId
 * @param {object | null | undefined} playerRecord
 */
function syncHubPresencePlayer(lobby, playerId, playerRecord) {
  if (!lobby || !playerId || !playerRecord) return;
  ensureHubPresence(lobby);
  lobby.hubPresence.players[playerId] = hubPresenceEntryFromPlayer(playerRecord, playerId);
}

/**
 * Refresh hub presence from all connected members in lobby state (tick path).
 *
 * @param {{ state?: { players?: object } } | null | undefined} lobby
 */
function syncHubPresenceFromLobbyState(lobby) {
  if (!lobby?.state?.players) return;
  for (const [playerId, playerRecord] of Object.entries(lobby.state.players)) {
    if (playerRecord?.connected === false) continue;
    syncHubPresencePlayer(lobby, playerId, playerRecord);
  }
}

/**
 * Remove one member from the lobby-scoped presence registry.
 *
 * @param {{ hubPresence?: { players?: object } } | null | undefined} lobby
 * @param {string | null | undefined} playerId
 */
function removeHubPresencePlayer(lobby, playerId) {
  if (!lobby || !playerId) return;
  ensureHubPresence(lobby);
  delete lobby.hubPresence.players[playerId];
}

/**
 * Build a lobby-scoped presence payload for broadcast.
 *
 * @param {{ id?: string, hubPresence?: { players?: object }, state?: { players?: object } } | null | undefined} lobby
 * @param {string | null | undefined} viewerPlayerId Reserved for future per-viewer interest culling; not applied yet.
 * @returns {{ lobbyId: string | null, players: Record<string, object> }}
 */
function buildHubPresenceUpdate(lobby, viewerPlayerId) {
  void viewerPlayerId;
  if (!lobby) {
    return { lobbyId: null, players: {} };
  }
  ensureHubPresence(lobby);

  const players = {};
  for (const [id, entry] of Object.entries(lobby.hubPresence.players)) {
    const statePlayer = lobby.state?.players?.[id];
    if (statePlayer?.connected === false) {
      continue;
    }
    players[id] = { ...entry };
  }

  return { lobbyId: lobby.id ?? null, players };
}

module.exports = {
  ensureHubPresence,
  syncHubPresencePlayer,
  syncHubPresenceFromLobbyState,
  removeHubPresencePlayer,
  buildHubPresenceUpdate,
};
