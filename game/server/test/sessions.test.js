import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import RedisMock from 'ioredis-mock';

const require = createRequire(import.meta.url);
const {
  createSession,
  getSession,
  destroySession,
  refreshSession,
  SESSION_TTL_SECONDS,
  SESSION_KEY_PREFIX,
} = require('../sessions.js');
const {
  getRedisClient,
  closeRedis,
  setRedisConstructorForTests,
  clearRedisConstructorForTests,
} = require('../redis.js');

describe('sessions module', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    delete process.env.REDIS_URL;
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

  describe('in-memory shim (REDIS_URL unset)', () => {
    it('createSession stores a 32-byte base64url token and session hash', async () => {
      const token = await createSession('acct-1');
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);

      const redis = getRedisClient();
      const key = `${SESSION_KEY_PREFIX}${token}`;
      expect(await redis.hgetall(key)).toMatchObject({
        accountId: 'acct-1',
      });
      expect(await redis.hget(key, 'createdAt')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(await redis.hget(key, 'lastSeen')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('getSession returns session data and refreshes lastSeen', async () => {
      const token = await createSession('acct-2');
      const first = await getSession(token);

      expect(first).toEqual({
        accountId: 'acct-2',
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        lastSeen: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
      expect(first.createdAt).toBeTruthy();
      expect(first.lastSeen).toBeTruthy();

      const second = await getSession(token);
      expect(second.accountId).toBe('acct-2');
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.lastSeen).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('getSession returns null for unknown tokens', async () => {
      expect(await getSession('missing-token')).toBeNull();
      expect(await getSession(null)).toBeNull();
      expect(await getSession('')).toBeNull();
    });

    it('destroySession removes the session and reports whether a key was deleted', async () => {
      const token = await createSession('acct-3');
      expect(await getSession(token)).not.toBeNull();

      expect(await destroySession(token)).toBe(true);
      expect(await getSession(token)).toBeNull();
      expect(await destroySession(token)).toBe(false);
    });

    it('refreshSession extends TTL without requiring getSession', async () => {
      vi.useFakeTimers();
      try {
        const token = await createSession('acct-refresh');
        const redis = getRedisClient();
        const key = `${SESSION_KEY_PREFIX}${token}`;

        vi.advanceTimersByTime((SESSION_TTL_SECONDS - 60) * 1000);
        expect(await refreshSession(token)).toBe(true);
        expect(await redis.hget(key, 'accountId')).toBe('acct-refresh');

        vi.advanceTimersByTime(120 * 1000);
        expect(await getSession(token)).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('getSession extends TTL on access (sliding window)', async () => {
      vi.useFakeTimers();
      try {
        const token = await createSession('acct-ttl');
        const redis = getRedisClient();
        const key = `${SESSION_KEY_PREFIX}${token}`;

        vi.advanceTimersByTime((SESSION_TTL_SECONDS - 30) * 1000);
        expect(await getSession(token)).not.toBeNull();

        vi.advanceTimersByTime(60 * 1000);
        expect(await redis.hget(key, 'accountId')).toBe('acct-ttl');
        expect(await getSession(token)).not.toBeNull();

        vi.advanceTimersByTime(SESSION_TTL_SECONDS * 1000);
        expect(await getSession(token)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('exports SESSION_TTL_SECONDS as 24 hours', () => {
      expect(SESSION_TTL_SECONDS).toBe(86400);
    });
  });

  describe('ioredis-mock cross-instance persistence', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://mock';
      setRedisConstructorForTests(RedisMock);
      closeRedis();
    });

    it('session survives closeRedis and a new getRedisClient lifecycle', async () => {
      const token = await createSession('acct-cross');
      expect(await getSession(token)).toMatchObject({ accountId: 'acct-cross' });

      closeRedis();
      const redis = getRedisClient();
      expect(redis).toBeInstanceOf(RedisMock);

      const session = await getSession(token);
      expect(session).toMatchObject({
        accountId: 'acct-cross',
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        lastSeen: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
    });
  });
});
