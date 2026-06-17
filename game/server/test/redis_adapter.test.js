import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import RedisMock from 'ioredis-mock';
import {
  startServer,
  resetGameState,
  io as serverIo,
  server as httpServer,
  clearAllTimers,
} from '../index.js';

const require = createRequire(import.meta.url);
const {
  closeRedis,
  enableRedisForTests,
  disableRedisForTests,
  setRedisConstructorForTests,
  clearRedisConstructorForTests,
} = require('../redis.js');

async function bootServer() {
  if (httpServer.listening) {
    await new Promise((resolve) => {
      const t = setTimeout(() => {
        try { serverIo.close(); } catch (_) {}
        httpServer.close(resolve);
      }, 5000);
      httpServer.close(() => { clearTimeout(t); resolve(); });
    });
  }

  resetGameState();
  serverIo.removeAllListeners('connection');
  clearAllTimers();
  await startServer(0);
}

async function shutdownServer() {
  if (!httpServer.listening) return;
  await new Promise((resolve) => {
    try { serverIo.close(); } catch (_) {}
    httpServer.close(() => resolve());
  });
}

describe('Socket.IO Redis adapter wiring', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(async () => {
    await shutdownServer();
    closeRedis();
    clearRedisConstructorForTests();
    disableRedisForTests();
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  describe('with Redis enabled', () => {
    beforeEach(async () => {
      process.env.REDIS_URL = 'redis://127.0.0.1:6379';
      setRedisConstructorForTests(RedisMock);
      closeRedis();
      await bootServer();
    });

    it('installs the Redis adapter on the default namespace', () => {
      const adapter = serverIo.of('/').adapter;
      expect(adapter.constructor.name).toBe('RedisAdapter');
      expect(adapter.pubClient).toBeDefined();
      expect(adapter.subClient).toBeDefined();
    });
  });

  describe('with Redis disabled', () => {
    beforeEach(async () => {
      delete process.env.REDIS_URL;
      disableRedisForTests();
      closeRedis();
      await bootServer();
    });

    it('keeps the default in-memory adapter', () => {
      const adapter = serverIo.of('/').adapter;
      expect(adapter.constructor.name).not.toBe('RedisAdapter');
      expect(adapter.pubClient).toBeUndefined();
    });
  });

  describe('with enableRedisForTests() and memory pub/sub shim', () => {
    beforeEach(async () => {
      delete process.env.REDIS_URL;
      closeRedis();
      enableRedisForTests();
      await bootServer();
    });

    it('installs the Redis adapter using the in-memory pub/sub shim', () => {
      const adapter = serverIo.of('/').adapter;
      expect(adapter.constructor.name).toBe('RedisAdapter');
      expect(adapter.pubClient).toBeDefined();
      expect(adapter.pubClient._isMemoryShim).toBe(true);
    });
  });
});
