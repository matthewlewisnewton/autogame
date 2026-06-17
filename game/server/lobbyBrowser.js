const { isRedisEnabled, getInstanceId, getRedisClient } = require('./redis');
const { listLobbySummaries } = require('./lobbies');

const LOBBY_KEY_PREFIX = 'lobbies:';
const PUBLISH_TTL_SEC = 30;

function lobbyKeyForInstance(instanceId) {
  return `${LOBBY_KEY_PREFIX}${instanceId}`;
}

function instanceIdFromLobbyKey(key) {
  if (!key.startsWith(LOBBY_KEY_PREFIX)) return null;
  return key.slice(LOBBY_KEY_PREFIX.length);
}

function sortSummaries(summaries) {
  return [...summaries].sort((a, b) => {
    const nameA = typeof a.name === 'string' ? a.name : '';
    const nameB = typeof b.name === 'string' ? b.name : '';
    const byName = nameA.localeCompare(nameB);
    if (byName !== 0) return byName;
    return String(a.id).localeCompare(String(b.id));
  });
}

function isVisibleLobbySummary(summary) {
  return summary && typeof summary.id === 'string' && Number(summary.playerCount) > 0;
}

function tagSummariesWithInstanceId(summaries, instanceId) {
  return summaries.map((summary) => ({
    ...summary,
    instanceId: summary.instanceId ?? instanceId,
  }));
}

async function scanLobbyKeys(client) {
  const keys = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await client.scan(cursor, 'MATCH', `${LOBBY_KEY_PREFIX}*`, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

async function publishLocalLobbies() {
  if (!isRedisEnabled()) {
    return;
  }

  const client = getRedisClient();
  const instanceId = getInstanceId();
  const key = lobbyKeyForInstance(instanceId);
  const summaries = tagSummariesWithInstanceId(listLobbySummaries(), instanceId);
  const payload = JSON.stringify(summaries);

  if (client._isMemoryShim) {
    await client.set(key, payload);
    await client.expire(key, PUBLISH_TTL_SEC);
  } else {
    await client.set(key, payload, 'EX', PUBLISH_TTL_SEC);
  }

  const { reconcileStaleLobbyOwners } = require('./lobbyRegistry');
  const localLobbies = require('./lobbies');
  await reconcileStaleLobbyOwners(() => [...localLobbies._lobbies.keys()]);
}

async function listGlobalLobbySummaries() {
  if (!isRedisEnabled()) {
    return listLobbySummaries();
  }

  const client = getRedisClient();
  const localInstanceId = getInstanceId();
  const seenIds = new Set();
  const merged = [];

  for (const summary of tagSummariesWithInstanceId(listLobbySummaries(), localInstanceId)) {
    if (!isVisibleLobbySummary(summary)) continue;
    seenIds.add(summary.id);
    merged.push(summary);
  }

  const keys = await scanLobbyKeys(client);
  for (const key of keys) {
    const remoteInstanceId = instanceIdFromLobbyKey(key);
    if (!remoteInstanceId || remoteInstanceId === localInstanceId) continue;

    const raw = await client.get(key);
    if (raw == null) continue;

    let remoteSummaries;
    try {
      remoteSummaries = JSON.parse(raw);
    } catch (_) {
      continue;
    }
    if (!Array.isArray(remoteSummaries)) continue;

    for (const summary of remoteSummaries) {
      if (!isVisibleLobbySummary(summary) || seenIds.has(summary.id)) continue;
      seenIds.add(summary.id);
      merged.push(tagSummariesWithInstanceId([summary], remoteInstanceId)[0]);
    }
  }

  return sortSummaries(merged);
}

async function resetLobbyBrowserForTests() {
  if (!isRedisEnabled()) {
    return;
  }
  const client = getRedisClient();
  const keys = await scanLobbyKeys(client);
  if (keys.length > 0) {
    await client.del(...keys);
  }
}

module.exports = {
  publishLocalLobbies,
  listGlobalLobbySummaries,
  resetLobbyBrowserForTests,
  LOBBY_KEY_PREFIX,
  PUBLISH_TTL_SEC,
};
