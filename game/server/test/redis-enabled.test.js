import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import {
  isRedisEnabled,
  getRedisClient,
  createPubSubClients,
  closeRedis,
  setRedisConstructorForTests,
  clearRedisConstructorForTests,
} from '../redis.js';

describe('redis module (enabled paths)', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    setRedisConstructorForTests(RedisMock);
    closeRedis();
  });

  afterEach(() => {
    closeRedis();
    clearRedisConstructorForTests();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('uses ioredis when REDIS_URL is set', () => {
    expect(isRedisEnabled()).toBe(true);
    const client = getRedisClient();
    expect(client._isMemoryShim).toBeUndefined();
    expect(client).toBeInstanceOf(RedisMock);
  });

  it('returns distinct pub/sub clients suitable for the Socket.IO adapter', async () => {
    const mainClient = getRedisClient();
    const { pubClient, subClient } = createPubSubClients();

    expect(pubClient).not.toBe(subClient);
    expect(pubClient).not.toBe(mainClient);
    expect(pubClient).toBeInstanceOf(RedisMock);
    expect(subClient).toBeInstanceOf(RedisMock);

    await pubClient.set('adapter-check', 'ok');
    expect(await subClient.get('adapter-check')).toBe('ok');
  });
});
