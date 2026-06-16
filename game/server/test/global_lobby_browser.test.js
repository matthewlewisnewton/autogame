import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  publishLocalLobbies,
  listGlobalLobbySummaries,
  resetLobbyBrowserForTests,
  LOBBY_KEY_PREFIX,
  PUBLISH_TTL_SEC,
} = require('../lobbyBrowser.js');
const {
  isRedisEnabled,
  enableRedisForTests,
  disableRedisForTests,
  closeRedis,
  getRedisClient,
} = require('../redis.js');
const {
  createLobby,
  assignPlayerToLobby,
  listLobbySummaries,
  resetAllLobbies,
} = require('../lobbies.js');

function remoteLobbySummary(id, name) {
  return {
    id,
    name,
    gamePhase: 'lobby',
    selectedQuestId: 'training_caverns',
    selectedQuestTier: 1,
    playerCount: 1,
    players: [{ id: 'remote-host', username: 'remote-host', ready: false }],
  };
}

describe('global lobby browser', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalInstanceId = process.env.INSTANCE_ID;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.INSTANCE_ID;
    closeRedis();
    disableRedisForTests();
    resetAllLobbies();
  });

  afterEach(async () => {
    await resetLobbyBrowserForTests();
    closeRedis();
    disableRedisForTests();
    resetAllLobbies();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
    if (originalInstanceId === undefined) {
      delete process.env.INSTANCE_ID;
    } else {
      process.env.INSTANCE_ID = originalInstanceId;
    }
    vi.useRealTimers();
  });

  describe('with Redis disabled', () => {
    it('listGlobalLobbySummaries matches listLobbySummaries', async () => {
      const lobby = createLobby('Local Only');
      lobby.state.players['host-1'] = { id: 'host-1', connected: true };
      assignPlayerToLobby('host-1', lobby.id);

      const local = listLobbySummaries();
      const global = await listGlobalLobbySummaries();
      expect(global).toEqual(local);
    });

    it('publishLocalLobbies is a no-op', async () => {
      await expect(publishLocalLobbies()).resolves.toBeUndefined();
      expect(isRedisEnabled()).toBe(false);
    });
  });

  describe('with Redis enabled (memory shim)', () => {
    beforeEach(() => {
      enableRedisForTests();
      process.env.INSTANCE_ID = 'instance-a';
    });

    it('aggregates lobbies published by two instance ids', async () => {
      const localLobby = createLobby('Alpha Squad');
      localLobby.state.players['host-a'] = { id: 'host-a', connected: true };
      assignPlayerToLobby('host-a', localLobby.id);
      await publishLocalLobbies();

      const client = getRedisClient();
      const remoteLobby = remoteLobbySummary('remote1234', 'Beta Squad');
      await client.set(
        `${LOBBY_KEY_PREFIX}instance-b`,
        JSON.stringify([{ ...remoteLobby, instanceId: 'instance-b' }]),
      );
      await client.expire(`${LOBBY_KEY_PREFIX}instance-b`, PUBLISH_TTL_SEC);

      const summaries = await listGlobalLobbySummaries();
      expect(summaries.map((s) => s.id).sort()).toEqual([localLobby.id, 'remote1234'].sort());
      expect(summaries.find((s) => s.id === localLobby.id)).toMatchObject({
        name: 'Alpha Squad',
        instanceId: 'instance-a',
      });
      expect(summaries.find((s) => s.id === 'remote1234')).toMatchObject({
        name: 'Beta Squad',
        instanceId: 'instance-b',
      });
    });

    it('excludes ghost lobbies and expired instance snapshots', async () => {
      vi.useFakeTimers();

      const visibleLobby = createLobby('Visible');
      visibleLobby.state.players['host-1'] = { id: 'host-1', connected: true };
      assignPlayerToLobby('host-1', visibleLobby.id);
      await publishLocalLobbies();

      const client = getRedisClient();
      const ghost = remoteLobbySummary('ghost1234', 'Ghost Room');
      ghost.playerCount = 0;
      ghost.players = [];
      await client.set(
        `${LOBBY_KEY_PREFIX}instance-b`,
        JSON.stringify([ghost]),
      );
      await client.expire(`${LOBBY_KEY_PREFIX}instance-b`, PUBLISH_TTL_SEC);

      const staleKey = `${LOBBY_KEY_PREFIX}instance-c`;
      await client.set(
        staleKey,
        JSON.stringify([remoteLobbySummary('stale1234', 'Stale Room')]),
      );
      await client.expire(staleKey, 1);

      vi.advanceTimersByTime(2000);

      const summaries = await listGlobalLobbySummaries();
      expect(summaries.map((s) => s.id)).toEqual([visibleLobby.id]);
    });

    it('dedupes by lobby id with local summaries winning', async () => {
      const localLobby = createLobby('Local Wins');
      localLobby.state.players['host-1'] = { id: 'host-1', connected: true };
      assignPlayerToLobby('host-1', localLobby.id);
      await publishLocalLobbies();

      const client = getRedisClient();
      await client.set(
        `${LOBBY_KEY_PREFIX}instance-b`,
        JSON.stringify([
          {
            ...remoteLobbySummary(localLobby.id, 'Remote Duplicate'),
            instanceId: 'instance-b',
          },
        ]),
      );
      await client.expire(`${LOBBY_KEY_PREFIX}instance-b`, PUBLISH_TTL_SEC);

      const summaries = await listGlobalLobbySummaries();
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        id: localLobby.id,
        name: 'Local Wins',
        instanceId: 'instance-a',
      });
    });
  });
});
