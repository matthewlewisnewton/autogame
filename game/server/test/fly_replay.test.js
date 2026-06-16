import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const lobbyRegistry = require('../lobbyRegistry.js');
const {
  getFlyMachineId,
  isFlyReplayEnabled,
  resolveLobbyRouting,
} = require('../flyReplay.js');
const {
  enableRedisForTests,
  disableRedisForTests,
  closeRedis,
} = require('../redis.js');

describe('flyReplay', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalFlyMachineId = process.env.FLY_MACHINE_ID;
  const originalInstanceId = process.env.INSTANCE_ID;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.FLY_MACHINE_ID;
    delete process.env.INSTANCE_ID;
    closeRedis();
    disableRedisForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    closeRedis();
    disableRedisForTests();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
    if (originalFlyMachineId === undefined) {
      delete process.env.FLY_MACHINE_ID;
    } else {
      process.env.FLY_MACHINE_ID = originalFlyMachineId;
    }
    if (originalInstanceId === undefined) {
      delete process.env.INSTANCE_ID;
    } else {
      process.env.INSTANCE_ID = originalInstanceId;
    }
  });

  describe('getFlyMachineId', () => {
    it('returns trimmed FLY_MACHINE_ID when set', () => {
      process.env.FLY_MACHINE_ID = '  fly-machine-1  ';
      expect(getFlyMachineId()).toBe('fly-machine-1');
    });

    it('returns null when FLY_MACHINE_ID is unset or blank', () => {
      expect(getFlyMachineId()).toBeNull();
      process.env.FLY_MACHINE_ID = '   ';
      expect(getFlyMachineId()).toBeNull();
    });
  });

  describe('isFlyReplayEnabled', () => {
    it('is false when Redis is disabled', () => {
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      expect(isFlyReplayEnabled()).toBe(false);
    });

    it('is false when FLY_MACHINE_ID is unset', () => {
      enableRedisForTests();
      expect(isFlyReplayEnabled()).toBe(false);
    });

    it('is true only when Redis is enabled and FLY_MACHINE_ID is set', () => {
      enableRedisForTests();
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      expect(isFlyReplayEnabled()).toBe(true);
    });
  });

  describe('resolveLobbyRouting', () => {
    it('returns self without consulting the registry when routing is disabled', async () => {
      const getLobbyOwnerSpy = vi.spyOn(lobbyRegistry, 'getLobbyOwner');

      await expect(resolveLobbyRouting('lobby-1')).resolves.toEqual({ action: 'self' });
      expect(getLobbyOwnerSpy).not.toHaveBeenCalled();
    });

    it('returns self for empty lobby ids without consulting the registry', async () => {
      enableRedisForTests();
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      const getLobbyOwnerSpy = vi.spyOn(lobbyRegistry, 'getLobbyOwner');

      await expect(resolveLobbyRouting('')).resolves.toEqual({ action: 'self' });
      await expect(resolveLobbyRouting('   ')).resolves.toEqual({ action: 'self' });
      await expect(resolveLobbyRouting(null)).resolves.toEqual({ action: 'self' });
      expect(getLobbyOwnerSpy).not.toHaveBeenCalled();
    });

    it('returns self when this machine owns the lobby', async () => {
      enableRedisForTests();
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      vi.spyOn(lobbyRegistry, 'getLobbyOwner').mockResolvedValue('fly-machine-1');

      await expect(resolveLobbyRouting('lobby-1')).resolves.toEqual({ action: 'self' });
    });

    it('returns replay when another machine owns the lobby', async () => {
      enableRedisForTests();
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      vi.spyOn(lobbyRegistry, 'getLobbyOwner').mockResolvedValue('fly-machine-2');

      await expect(resolveLobbyRouting('lobby-1')).resolves.toEqual({
        action: 'replay',
        machineId: 'fly-machine-2',
      });
    });

    it('returns self with claimOwner when the owner is unknown', async () => {
      enableRedisForTests();
      process.env.FLY_MACHINE_ID = 'fly-machine-1';
      vi.spyOn(lobbyRegistry, 'getLobbyOwner').mockResolvedValue(null);

      await expect(resolveLobbyRouting('lobby-1')).resolves.toEqual({
        action: 'self',
        claimOwner: true,
      });
    });

    it('returns self without consulting the registry when FLY_MACHINE_ID is unset', async () => {
      enableRedisForTests();
      const getLobbyOwnerSpy = vi.spyOn(lobbyRegistry, 'getLobbyOwner');

      await expect(resolveLobbyRouting('lobby-1')).resolves.toEqual({ action: 'self' });
      expect(getLobbyOwnerSpy).not.toHaveBeenCalled();
    });
  });
});
