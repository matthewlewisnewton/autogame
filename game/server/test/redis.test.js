import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isRedisEnabled,
  getInstanceId,
  getRedisClient,
  createPubSubClients,
  closeRedis,
  resetRedisForTests,
} from '../redis.js';

describe('redis module', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalInstanceId = process.env.INSTANCE_ID;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.INSTANCE_ID;
    closeRedis();
  });

  afterEach(() => {
    closeRedis();
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
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('reports disabled when REDIS_URL is unset', () => {
    expect(isRedisEnabled()).toBe(false);
  });

  it('reports enabled when REDIS_URL is set', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    expect(isRedisEnabled()).toBe(true);
  });

  it('uses INSTANCE_ID from the environment when set', () => {
    process.env.INSTANCE_ID = 'instance-a';
    expect(getInstanceId()).toBe('instance-a');
    expect(getInstanceId()).toBe('instance-a');
  });

  it('generates a stable UUID instance id per process when INSTANCE_ID is unset', () => {
    const first = getInstanceId();
    const second = getInstanceId();
    expect(first).toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  describe('in-memory shim', () => {
    it('supports hash, string, delete, and expire commands', async () => {
      const client = getRedisClient();
      expect(client._isMemoryShim).toBe(true);

      await client.hset('lobby:1', 'name', 'Alpha');
      await client.hset('lobby:1', { players: '2', phase: 'lobby' });
      expect(await client.hget('lobby:1', 'name')).toBe('Alpha');
      expect(await client.hgetall('lobby:1')).toEqual({
        name: 'Alpha',
        players: '2',
        phase: 'lobby',
      });

      await client.hdel('lobby:1', 'phase');
      expect(await client.hget('lobby:1', 'phase')).toBeNull();

      await client.set('counter', '7');
      expect(await client.get('counter')).toBe('7');

      await client.del('counter');
      expect(await client.get('counter')).toBeNull();
      expect(await client.hgetall('lobby:1')).toEqual({
        name: 'Alpha',
        players: '2',
      });
    });

    it('expires keys after the TTL elapses', async () => {
      vi.useFakeTimers();
      try {
        const client = getRedisClient();
        await client.set('temp', 'value');
        await client.expire('temp', 1);
        expect(await client.get('temp')).toBe('value');

        vi.advanceTimersByTime(1001);
        expect(await client.get('temp')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('scans keys by prefix', async () => {
      const client = getRedisClient();
      await client.set('lobby:1', 'a');
      await client.set('lobby:2', 'b');
      await client.set('player:1', 'c');

      const [cursor, keys] = await client.scan('0', 'MATCH', 'lobby:*', 'COUNT', 10);
      expect(cursor).toBe('0');
      expect(keys.sort()).toEqual(['lobby:1', 'lobby:2']);
    });

    it('clears shim state between resets', async () => {
      const client = getRedisClient();
      await client.set('persist-me', 'nope');
      closeRedis();

      const freshClient = getRedisClient();
      expect(freshClient._isMemoryShim).toBe(true);
      expect(await freshClient.get('persist-me')).toBeNull();
    });

    it('resetRedisForTests is an alias for closeRedis', async () => {
      const client = getRedisClient();
      await client.set('key', 'value');
      resetRedisForTests();
      expect(await getRedisClient().get('key')).toBeNull();
    });

    it('fans out pub/sub locally when redis is disabled', async () => {
      const { pubClient, subClient } = createPubSubClients();
      expect(pubClient).not.toBe(subClient);

      const messages = [];
      await new Promise((resolve) => {
        subClient.on('message', (channel, message) => {
          messages.push({ channel, message });
          resolve();
        });
        subClient.subscribe('lobby-events');
        pubClient.publish('lobby-events', 'refresh');
      });

      expect(messages).toEqual([{ channel: 'lobby-events', message: 'refresh' }]);
    });
  });
});
