import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import RedisMock from 'ioredis-mock';

const require = createRequire(import.meta.url);
const {
  registerLobby,
  unregisterLobby,
  getLobbyOwner,
  resetLobbyRegistryForTests,
} = require('../lobbyRegistry.js');
const {
  isRedisEnabled,
  enableRedisForTests,
  disableRedisForTests,
  closeRedis,
  setRedisConstructorForTests,
  clearRedisConstructorForTests,
} = require('../redis.js');
const {
  createLobby,
  removePlayerFromLobby,
  assignPlayerToLobby,
  resetAllLobbies,
} = require('../lobbies.js');

describe('lobbyRegistry', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalInstanceId = process.env.INSTANCE_ID;
  const originalFlyMachineId = process.env.FLY_MACHINE_ID;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.INSTANCE_ID;
    delete process.env.FLY_MACHINE_ID;
    closeRedis();
    disableRedisForTests();
    resetAllLobbies();
  });

  afterEach(async () => {
    await resetLobbyRegistryForTests();
    closeRedis();
    disableRedisForTests();
    clearRedisConstructorForTests();
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
    if (originalFlyMachineId === undefined) {
      delete process.env.FLY_MACHINE_ID;
    } else {
      process.env.FLY_MACHINE_ID = originalFlyMachineId;
    }
  });

  describe('with Redis disabled', () => {
    it('reports Redis as disabled', () => {
      expect(isRedisEnabled()).toBe(false);
    });

    it('registerLobby returns local instance id without persisting ownership', async () => {
      process.env.INSTANCE_ID = 'local-only';
      const result = await registerLobby('abc12345');
      expect(result).toBe('local-only');
      expect(await getLobbyOwner('abc12345')).toBeNull();
    });

    it('unregisterLobby is a no-op', async () => {
      await expect(unregisterLobby('abc12345')).resolves.toBeUndefined();
      expect(await getLobbyOwner('abc12345')).toBeNull();
    });
  });

  describe('with Redis enabled (memory shim)', () => {
    beforeEach(() => {
      process.env.INSTANCE_ID = 'instance-a';
      enableRedisForTests();
    });

    it('registers and unregisters lobby ownership in lobby:owners', async () => {
      await registerLobby('lobby-1');
      expect(await getLobbyOwner('lobby-1')).toBe('instance-a');

      await unregisterLobby('lobby-1');
      expect(await getLobbyOwner('lobby-1')).toBeNull();
    });

    it('preserves distinct owners for lobbies registered under different instance ids', async () => {
      process.env.INSTANCE_ID = 'instance-a';
      await registerLobby('lobby-a');

      process.env.INSTANCE_ID = 'instance-b';
      await registerLobby('lobby-b');

      expect(await getLobbyOwner('lobby-a')).toBe('instance-a');
      expect(await getLobbyOwner('lobby-b')).toBe('instance-b');
    });

    it('resetLobbyRegistryForTests clears the owners hash', async () => {
      await registerLobby('lobby-1');
      expect(await getLobbyOwner('lobby-1')).toBe('instance-a');

      await resetLobbyRegistryForTests();
      expect(await getLobbyOwner('lobby-1')).toBeNull();
    });
  });

  describe('with Redis enabled (ioredis-mock)', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://127.0.0.1:6379';
      process.env.INSTANCE_ID = 'mock-instance';
      setRedisConstructorForTests(RedisMock);
      closeRedis();
    });

    it('writes lobby:owners via HSET and HDEL', async () => {
      expect(isRedisEnabled()).toBe(true);
      await registerLobby('mock-lobby');
      expect(await getLobbyOwner('mock-lobby')).toBe('mock-instance');

      await unregisterLobby('mock-lobby');
      expect(await getLobbyOwner('mock-lobby')).toBeNull();
    });
  });

  describe('lobbies integration', () => {
    beforeEach(() => {
      process.env.INSTANCE_ID = 'integration-instance';
      enableRedisForTests();
    });

    it('createLobby registers ownership and removePlayerFromLobby clears it', async () => {
      const lobby = createLobby('Registry Test');
      await vi.waitFor(async () => {
        expect(await getLobbyOwner(lobby.id)).toBe('integration-instance');
      });

      lobby.state.players['host-1'] = { id: 'host-1' };
      assignPlayerToLobby('host-1', lobby.id);
      removePlayerFromLobby('host-1');

      await vi.waitFor(async () => {
        expect(await getLobbyOwner(lobby.id)).toBeNull();
      });
    });

    it('createLobby registers ownership using FLY_MACHINE_ID when set', async () => {
      delete process.env.INSTANCE_ID;
      process.env.FLY_MACHINE_ID = 'fly-machine-a';
      const { getFlyMachineId } = require('../flyReplay.js');

      const lobby = createLobby('Fly Machine Registry');
      await vi.waitFor(async () => {
        expect(await getLobbyOwner(lobby.id)).toBe('fly-machine-a');
        expect(await getLobbyOwner(lobby.id)).toBe(getFlyMachineId());
      });
    });
  });
});
