const { isRedisEnabled, getInstanceId, getRedisClient } = require('./redis');

const LOBBY_OWNERS_KEY = 'lobby:owners';
const LOBBY_KEY_PREFIX = 'lobbies:';

async function instancePublishKeyExists(client, instanceId) {
  const publishKey = `${LOBBY_KEY_PREFIX}${instanceId}`;
  if (typeof client.exists === 'function') {
    const count = await client.exists(publishKey);
    return Number(count) > 0;
  }
  const value = await client.get(publishKey);
  return value != null;
}

async function registerLobby(lobbyId) {
  const instanceId = getInstanceId();
  if (!isRedisEnabled()) {
    return instanceId;
  }
  const client = getRedisClient();
  await client.hset(LOBBY_OWNERS_KEY, String(lobbyId), instanceId);
  return instanceId;
}

async function unregisterLobby(lobbyId) {
  if (!isRedisEnabled()) {
    return;
  }
  const client = getRedisClient();
  await client.hdel(LOBBY_OWNERS_KEY, String(lobbyId));
}

async function getLobbyOwner(lobbyId) {
  if (!isRedisEnabled()) {
    return null;
  }
  const client = getRedisClient();
  const owner = await client.hget(LOBBY_OWNERS_KEY, String(lobbyId));
  return owner == null ? null : owner;
}

async function resetLobbyRegistryForTests() {
  if (!isRedisEnabled()) {
    return;
  }
  const client = getRedisClient();
  await client.del(LOBBY_OWNERS_KEY);
}

/**
 * Remove stale lobby:owners hash fields:
 *  - local instance owns a lobby id that is not in the in-memory lobby map, or
 *  - a remote instance has no active lobbies:<instanceId> publish key.
 */
async function reconcileStaleLobbyOwners(getLocalLobbyIds) {
  if (!isRedisEnabled()) {
    return;
  }
  const client = getRedisClient();
  const localInstanceId = getInstanceId();
  const localLobbyIds = new Set(
    typeof getLocalLobbyIds === 'function' ? getLocalLobbyIds() : [],
  );
  const owners = await client.hgetall(LOBBY_OWNERS_KEY);
  const staleFields = [];

  for (const [lobbyId, instanceId] of Object.entries(owners)) {
    if (instanceId === localInstanceId) {
      if (!localLobbyIds.has(lobbyId)) {
        staleFields.push(lobbyId);
      }
      continue;
    }
    const alive = await instancePublishKeyExists(client, instanceId);
    if (!alive) {
      staleFields.push(lobbyId);
    }
  }

  if (staleFields.length > 0) {
    await client.hdel(LOBBY_OWNERS_KEY, ...staleFields);
  }
}

module.exports = {
  registerLobby,
  unregisterLobby,
  getLobbyOwner,
  resetLobbyRegistryForTests,
  reconcileStaleLobbyOwners,
};
