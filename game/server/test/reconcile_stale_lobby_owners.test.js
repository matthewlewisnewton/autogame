import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  reconcileStaleLobbyOwners,
  getLobbyOwner,
  registerLobby,
  resetLobbyRegistryForTests,
} = require('../lobbyRegistry.js');
const { reconcileStaleLobbyOwnersSweep } = require('../index.js');
const {
  LOBBY_KEY_PREFIX,
  publishLocalLobbies,
  resetLobbyBrowserForTests,
} = require('../lobbyBrowser.js');
const {
  enableRedisForTests,
  disableRedisForTests,
  closeRedis,
  getRedisClient,
} = require('../redis.js');
const { createLobby, resetAllLobbies, _lobbies } = require('../lobbies.js');

const LOBBY_OWNERS_KEY = 'lobby:owners';

async function seedOwner(client, lobbyId, instanceId) {
  await client.hset(LOBBY_OWNERS_KEY, String(lobbyId), instanceId);
}

async function seedPublishKey(client, instanceId, payload = '[]') {
  const key = `${LOBBY_KEY_PREFIX}${instanceId}`;
  await client.set(key, payload);
  await client.expire(key, 30);
}

describe('reconcileStaleLobbyOwners', () => {
  const originalInstanceId = process.env.INSTANCE_ID;

  beforeEach(() => {
    resetAllLobbies();
  });

  afterEach(async () => {
    await resetLobbyRegistryForTests();
    await resetLobbyBrowserForTests();
    closeRedis();
    disableRedisForTests();
    resetAllLobbies();
    if (originalInstanceId === undefined) {
      delete process.env.INSTANCE_ID;
    } else {
      process.env.INSTANCE_ID = originalInstanceId;
    }
  });

  it('is a no-op when Redis is disabled', async () => {
    disableRedisForTests();
    await expect(
      reconcileStaleLobbyOwners(() => []),
    ).resolves.toBeUndefined();
  });

  describe('with Redis enabled', () => {
    beforeEach(() => {
      process.env.INSTANCE_ID = 'instance-b';
      enableRedisForTests();
    });

    it('removes owner fields for dead remote instances', async () => {
      const client = getRedisClient();
      await seedOwner(client, 'lobby-dead', 'dead-A');

      await reconcileStaleLobbyOwners(() => [..._lobbies.keys()]);

      expect(await getLobbyOwner('lobby-dead')).toBeNull();
    });

    it('removes local ghost owner fields not present in the lobby map', async () => {
      const client = getRedisClient();
      await seedOwner(client, 'ghost-lobby', 'instance-b');

      await reconcileStaleLobbyOwners(() => [..._lobbies.keys()]);

      expect(await getLobbyOwner('ghost-lobby')).toBeNull();
    });

    it('preserves remote owner fields when the publish key is alive', async () => {
      const client = getRedisClient();
      await seedOwner(client, 'remote-lobby', 'remote-B');
      await seedPublishKey(client, 'remote-B');

      await reconcileStaleLobbyOwners(() => [..._lobbies.keys()]);

      expect(await getLobbyOwner('remote-lobby')).toBe('remote-B');
    });

    it('preserves local owner fields for lobbies still in memory', async () => {
      const lobby = createLobby('Live Local');
      await registerLobby(lobby.id);

      await reconcileStaleLobbyOwners(() => [..._lobbies.keys()]);

      expect(await getLobbyOwner(lobby.id)).toBe('instance-b');
    });

    it('removes stale fields from a dead instance while keeping live owners', async () => {
      const client = getRedisClient();
      const liveLobby = createLobby('Instance B Lobby');

      await seedOwner(client, 'lobby-a1', 'instance-A');
      await seedOwner(client, 'lobby-a2', 'instance-A');
      await seedPublishKey(client, 'instance-A');
      await seedPublishKey(client, 'instance-b');

      await client.del(`${LOBBY_KEY_PREFIX}instance-A`);

      await reconcileStaleLobbyOwners(() => [..._lobbies.keys()]);

      expect(await getLobbyOwner('lobby-a1')).toBeNull();
      expect(await getLobbyOwner('lobby-a2')).toBeNull();
      expect(await getLobbyOwner(liveLobby.id)).toBe('instance-b');
    });
  });
});

describe('reconcileStaleLobbyOwnersSweep', () => {
  const originalInstanceId = process.env.INSTANCE_ID;

  beforeEach(() => {
    process.env.INSTANCE_ID = 'sweep-instance';
    enableRedisForTests();
    resetAllLobbies();
  });

  afterEach(async () => {
    await resetLobbyRegistryForTests();
    await resetLobbyBrowserForTests();
    closeRedis();
    disableRedisForTests();
    resetAllLobbies();
    if (originalInstanceId === undefined) {
      delete process.env.INSTANCE_ID;
    } else {
      process.env.INSTANCE_ID = originalInstanceId;
    }
  });

  it('prunes local ghosts via the index.js wrapper', async () => {
    const client = getRedisClient();
    await seedOwner(client, 'orphan-lobby', 'sweep-instance');

    reconcileStaleLobbyOwnersSweep();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await getLobbyOwner('orphan-lobby')).toBeNull();
  });
});

describe('publishLocalLobbies TTL refresh', () => {
  const originalInstanceId = process.env.INSTANCE_ID;

  beforeEach(() => {
    process.env.INSTANCE_ID = 'publish-instance';
    enableRedisForTests();
    resetAllLobbies();
  });

  afterEach(async () => {
    await resetLobbyRegistryForTests();
    await resetLobbyBrowserForTests();
    closeRedis();
    disableRedisForTests();
    resetAllLobbies();
    if (originalInstanceId === undefined) {
      delete process.env.INSTANCE_ID;
    } else {
      process.env.INSTANCE_ID = originalInstanceId;
    }
  });

  it('refreshes the instance publish key without reconciling owners inline', async () => {
    const client = getRedisClient();
    await seedOwner(client, 'stale-local', 'publish-instance');

    await publishLocalLobbies();

    // publishLocalLobbies no longer reconciles — that is the sweep's job.
    expect(await getLobbyOwner('stale-local')).toBe('publish-instance');
    const raw = await client.get('lobbies:publish-instance');
    expect(raw).toBeTruthy();
  });
});
