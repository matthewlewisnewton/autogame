const { isRedisEnabled, getInstanceId, getRedisClient } = require('./redis');

const LOBBY_OWNERS_KEY = 'lobby:owners';

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

module.exports = {
  registerLobby,
  unregisterLobby,
  getLobbyOwner,
  resetLobbyRegistryForTests,
};
