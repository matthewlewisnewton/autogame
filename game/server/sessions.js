// Opaque server-side sessions stored in Redis (or the in-memory shim when REDIS_URL is unset).

const crypto = require('crypto');
const { getRedisClient } = require('./redis.js');

const SESSION_KEY_PREFIX = 'session:';
const SESSION_TTL_SECONDS = 86400;
let _sessionDestroyedHandler = null;

function sessionKey(token) {
  return `${SESSION_KEY_PREFIX}${token}`;
}

function parseSession(hash) {
  if (!hash || !hash.accountId) return null;
  return {
    accountId: hash.accountId,
    createdAt: hash.createdAt,
    lastSeen: hash.lastSeen,
  };
}

/**
 * Create a new session for `accountId`. Returns an opaque base64url token.
 * `refreshSession` is also exported for TTL extension without a full read; `getSession`
 * performs the same sliding-window refresh when loading a session.
 */
async function createSession(accountId) {
  const redis = getRedisClient();
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date().toISOString();
  const key = sessionKey(token);

  await redis.hset(key, {
    accountId: String(accountId),
    createdAt: now,
    lastSeen: now,
  });
  await redis.expire(key, SESSION_TTL_SECONDS);

  return token;
}

/**
 * Extend sliding TTL and update lastSeen without returning session data.
 * Returns false when the token is missing or unknown.
 */
async function refreshSession(token) {
  if (!token) return false;
  const redis = getRedisClient();
  const key = sessionKey(token);

  const exists = await redis.hget(key, 'accountId');
  if (!exists) return false;

  const now = new Date().toISOString();
  await redis.hset(key, 'lastSeen', now);
  await redis.expire(key, SESSION_TTL_SECONDS);
  return true;
}

async function getSession(token) {
  if (!token) return null;
  const redis = getRedisClient();
  const key = sessionKey(token);

  const hash = await redis.hgetall(key);
  const session = parseSession(hash);
  if (!session) return null;

  const now = new Date().toISOString();
  await redis.hset(key, 'lastSeen', now);
  await redis.expire(key, SESSION_TTL_SECONDS);
  session.lastSeen = now;

  return session;
}

async function destroySession(token) {
  if (!token) return false;
  const redis = getRedisClient();
  const removed = await redis.del(sessionKey(token));
  if (_sessionDestroyedHandler) {
    try {
      await _sessionDestroyedHandler(token);
    } catch (err) {
      // Revocation notification is best-effort; the authoritative Redis key is
      // already gone and future connections will still be rejected.
      console.error('[sessions] live-session revocation failed:', err);
    }
  }
  return removed > 0;
}

function setSessionDestroyedHandler(handler) {
  _sessionDestroyedHandler = typeof handler === 'function' ? handler : null;
}

module.exports = {
  createSession,
  getSession,
  destroySession,
  setSessionDestroyedHandler,
  refreshSession,
  SESSION_TTL_SECONDS,
  SESSION_KEY_PREFIX,
};
