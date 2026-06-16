// Shared Redis access layer — real ioredis when REDIS_URL is set, in-memory shim otherwise.

const crypto = require('crypto');

let Redis = null;
/** @type {typeof import('ioredis') | null} */
let _redisCtorOverride = null;

/** @type {import('ioredis') | MemoryRedisClient | null} */
let _mainClient = null;
/** @type {Array<import('ioredis') | MemoryPubSubClient>} */
let _pubSubClients = [];
/** @type {MemoryStore | null} */
let _memoryStore = null;
/** @type {MemoryPubSubBus | null} */
let _memoryPubSubBus = null;

let _instanceId = null;
let _forceRedisEnabledForTests = false;

function getRedisUrl() {
  const url = process.env.REDIS_URL;
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRedisEnabled() {
  return _forceRedisEnabledForTests || getRedisUrl() !== null;
}

function enableRedisForTests() {
  _forceRedisEnabledForTests = true;
}

function disableRedisForTests() {
  _forceRedisEnabledForTests = false;
  closeRedis();
}

function getInstanceId() {
  if (typeof process.env.INSTANCE_ID === 'string' && process.env.INSTANCE_ID.length > 0) {
    return process.env.INSTANCE_ID;
  }
  if (!_instanceId) {
    _instanceId = crypto.randomUUID();
  }
  return _instanceId;
}

function patternToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexSource = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
  return new RegExp(regexSource);
}

class MemoryStore {
  constructor() {
    /** @type {Map<string, Map<string, string>>} */
    this.hashes = new Map();
    /** @type {Map<string, string>} */
    this.strings = new Map();
    /** @type {Map<string, number>} */
    this.expirations = new Map();
  }

  clear() {
    this.hashes.clear();
    this.strings.clear();
    this.expirations.clear();
  }

  purgeIfExpired(key) {
    const expiresAt = this.expirations.get(key);
    if (expiresAt == null) return false;
    if (Date.now() < expiresAt) return false;
    this.hashes.delete(key);
    this.strings.delete(key);
    this.expirations.delete(key);
    return true;
  }

  allKeys() {
    const keys = new Set([...this.hashes.keys(), ...this.strings.keys()]);
    for (const key of keys) {
      if (this.purgeIfExpired(key)) {
        keys.delete(key);
      }
    }
    return [...keys];
  }

  async hset(key, ...args) {
    this.purgeIfExpired(key);
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const hash = this.hashes.get(key);
    let added = 0;

    if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      for (const [field, value] of Object.entries(args[0])) {
        if (!hash.has(field)) added += 1;
        hash.set(String(field), String(value));
      }
      return added;
    }

    for (let i = 0; i < args.length; i += 2) {
      const field = String(args[i]);
      const value = String(args[i + 1]);
      if (!hash.has(field)) added += 1;
      hash.set(field, value);
    }
    return added;
  }

  async hget(key, field) {
    this.purgeIfExpired(key);
    const hash = this.hashes.get(key);
    if (!hash) return null;
    return hash.has(field) ? hash.get(field) : null;
  }

  async hgetall(key) {
    this.purgeIfExpired(key);
    const hash = this.hashes.get(key);
    if (!hash || hash.size === 0) return {};
    const out = {};
    for (const [field, value] of hash.entries()) {
      out[field] = value;
    }
    return out;
  }

  async hdel(key, ...fields) {
    this.purgeIfExpired(key);
    const hash = this.hashes.get(key);
    if (!hash) return 0;
    let removed = 0;
    for (const field of fields) {
      if (hash.delete(String(field))) removed += 1;
    }
    if (hash.size === 0) {
      this.hashes.delete(key);
    }
    return removed;
  }

  async set(key, value) {
    this.purgeIfExpired(key);
    this.strings.set(key, String(value));
    return 'OK';
  }

  async get(key) {
    this.purgeIfExpired(key);
    return this.strings.has(key) ? this.strings.get(key) : null;
  }

  async del(...keys) {
    let removed = 0;
    for (const key of keys) {
      this.purgeIfExpired(key);
      const hadHash = this.hashes.delete(key);
      const hadString = this.strings.delete(key);
      const hadExpiry = this.expirations.delete(key);
      if (hadHash || hadString || hadExpiry) removed += 1;
    }
    return removed;
  }

  async expire(key, seconds) {
    this.purgeIfExpired(key);
    const exists = this.hashes.has(key) || this.strings.has(key);
    if (!exists) return 0;
    this.expirations.set(key, Date.now() + Number(seconds) * 1000);
    return 1;
  }

  async scan(cursor, ...args) {
    let match = '*';
    let count = 10;
    for (let i = 0; i < args.length; i += 2) {
      if (String(args[i]).toUpperCase() === 'MATCH') match = args[i + 1];
      if (String(args[i]).toUpperCase() === 'COUNT') count = Number(args[i + 1]);
    }

    const regex = patternToRegex(String(match));
    const matched = this.allKeys().filter((key) => regex.test(key));
    const start = Number(cursor) || 0;
    const slice = matched.slice(start, start + count);
    const nextCursor = start + count >= matched.length ? '0' : String(start + count);
    return [nextCursor, slice];
  }
}

class MemoryPubSubBus {
  constructor() {
    /** @type {Map<string, Set<(channel: string, message: string) => void>>} */
    this.subscribers = new Map();
  }

  clear() {
    this.subscribers.clear();
    if (this.patternSubscribers) {
      this.patternSubscribers.clear();
    }
  }

  subscribe(channel, listener) {
    const normalized = String(channel);
    if (!this.subscribers.has(normalized)) {
      this.subscribers.set(normalized, new Set());
    }
    this.subscribers.get(normalized).add(listener);
  }

  unsubscribe(channel, listener) {
    const normalized = String(channel);
    const listeners = this.subscribers.get(normalized);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.subscribers.delete(normalized);
    }
  }

  publish(channel, message) {
    const normalized = String(channel);
    const payload = String(message);
    const listeners = this.subscribers.get(normalized);
    if (!listeners) return 0;
    for (const listener of listeners) {
      listener(normalized, payload);
    }
    return listeners.size;
  }

  psubscribe(pattern, listener) {
    const normalized = String(pattern);
    if (!this.patternSubscribers) {
      this.patternSubscribers = new Map();
    }
    if (!this.patternSubscribers.has(normalized)) {
      this.patternSubscribers.set(normalized, new Set());
    }
    this.patternSubscribers.get(normalized).add(listener);
  }

  punsubscribe(pattern, listener) {
    if (!this.patternSubscribers) return;
    const normalized = String(pattern);
    const listeners = this.patternSubscribers.get(normalized);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.patternSubscribers.delete(normalized);
    }
  }

  publishToPatterns(channel, message) {
    if (!this.patternSubscribers || this.patternSubscribers.size === 0) return;
    const normalizedChannel = String(channel);
    const payload = String(message);
    for (const [pattern, listeners] of this.patternSubscribers.entries()) {
      if (!patternToRegex(pattern).test(normalizedChannel)) continue;
      for (const listener of listeners) {
        listener(pattern, normalizedChannel, payload);
      }
    }
  }
}

function getMemoryStore() {
  if (!_memoryStore) {
    _memoryStore = new MemoryStore();
  }
  return _memoryStore;
}

function getMemoryPubSubBus() {
  if (!_memoryPubSubBus) {
    _memoryPubSubBus = new MemoryPubSubBus();
  }
  return _memoryPubSubBus;
}

function createMemoryRedisClient() {
  const store = getMemoryStore();
  return {
    _isMemoryShim: true,
    hset: (...args) => store.hset(...args),
    hget: (...args) => store.hget(...args),
    hgetall: (...args) => store.hgetall(...args),
    hdel: (...args) => store.hdel(...args),
    set: (...args) => store.set(...args),
    get: (...args) => store.get(...args),
    del: (...args) => store.del(...args),
    expire: (...args) => store.expire(...args),
    scan: (...args) => store.scan(...args),
    quit: async () => undefined,
    disconnect: () => undefined,
  };
}

function createMemoryPubSubClient(bus) {
  const listeners = new Map();
  const subscriptions = new Set();
  const patternSubscriptions = new Set();
  const channelListeners = new Map();
  const patternListeners = new Map();

  const deliverChannelMessage = (channel, message) => {
    const payload = String(message);
    const messageBufferHandler = listeners.get('messageBuffer');
    const messageHandler = listeners.get('message');
    if (messageBufferHandler) {
      messageBufferHandler(Buffer.from(payload), channel);
    } else if (messageHandler) {
      messageHandler(channel, payload);
    }
    bus.publishToPatterns(channel, payload);
  };

  const client = {
    _isMemoryShim: true,
    on(event, handler) {
      listeners.set(event, handler);
      return client;
    },
    async subscribe(channel) {
      const channels = Array.isArray(channel) ? channel : [channel];
      for (const ch of channels) {
        const normalized = String(ch);
        subscriptions.add(normalized);
        if (!channelListeners.has(normalized)) {
          const listener = (incomingChannel, message) => {
            deliverChannelMessage(incomingChannel, message);
          };
          channelListeners.set(normalized, listener);
          bus.subscribe(normalized, listener);
        }
      }
      return subscriptions.size;
    },
    async unsubscribe(channel) {
      const channels = Array.isArray(channel) ? channel : [channel];
      for (const ch of channels) {
        const normalized = String(ch);
        subscriptions.delete(normalized);
        const listener = channelListeners.get(normalized);
        if (listener) {
          bus.unsubscribe(normalized, listener);
          channelListeners.delete(normalized);
        }
      }
      return subscriptions.size;
    },
    async psubscribe(pattern) {
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      for (const pat of patterns) {
        const normalized = String(pat);
        patternSubscriptions.add(normalized);
        if (!patternListeners.has(normalized)) {
          const listener = (matchedPattern, channel, message) => {
            const pmessageBufferHandler = listeners.get('pmessageBuffer');
            const pmessageHandler = listeners.get('pmessage');
            const payload = String(message);
            if (pmessageBufferHandler) {
              pmessageBufferHandler(matchedPattern, channel, Buffer.from(payload));
            } else if (pmessageHandler) {
              pmessageHandler(matchedPattern, channel, payload);
            }
          };
          patternListeners.set(normalized, listener);
          bus.psubscribe(normalized, listener);
        }
      }
      return patternSubscriptions.size;
    },
    async punsubscribe(pattern) {
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      for (const pat of patterns) {
        const normalized = String(pat);
        patternSubscriptions.delete(normalized);
        const listener = patternListeners.get(normalized);
        if (listener) {
          bus.punsubscribe(normalized, listener);
          patternListeners.delete(normalized);
        }
      }
      return patternSubscriptions.size;
    },
    async publish(channel, message) {
      const normalized = String(channel);
      const delivered = bus.publish(normalized, message);
      bus.publishToPatterns(normalized, message);
      return delivered;
    },
    duplicate() {
      return createMemoryPubSubClient(bus);
    },
    quit: async () => undefined,
    disconnect: () => undefined,
  };

  return client;
}

function setRedisConstructorForTests(RedisCtor) {
  _redisCtorOverride = RedisCtor;
}

function clearRedisConstructorForTests() {
  _redisCtorOverride = null;
}

function loadRedis() {
  if (_redisCtorOverride) {
    return _redisCtorOverride;
  }
  if (!Redis) {
    Redis = require('ioredis');
  }
  return Redis;
}

function getRedisClient() {
  const redisUrl = getRedisUrl();
  if (!isRedisEnabled() || !redisUrl) {
    if (!_mainClient) {
      _mainClient = createMemoryRedisClient();
    }
    return _mainClient;
  }

  if (!_mainClient) {
    const RedisCtor = loadRedis();
    _mainClient = new RedisCtor(redisUrl);
  }
  return _mainClient;
}

function createPubSubClients() {
  const redisUrl = getRedisUrl();
  if (!isRedisEnabled() || !redisUrl) {
    const bus = getMemoryPubSubBus();
    const pubClient = createMemoryPubSubClient(bus);
    const subClient = createMemoryPubSubClient(bus);
    _pubSubClients.push(pubClient, subClient);
    return { pubClient, subClient };
  }

  const RedisCtor = loadRedis();
  const pubClient = new RedisCtor(redisUrl);
  const subClient = new RedisCtor(redisUrl);
  _pubSubClients.push(pubClient, subClient);
  return { pubClient, subClient };
}

function closeRedis() {
  for (const client of _pubSubClients) {
    if (!client._isMemoryShim) {
      try {
        client.disconnect();
      } catch (_) {
        // ignore disconnect errors during teardown
      }
    }
  }
  _pubSubClients = [];

  if (_mainClient && !_mainClient._isMemoryShim) {
    try {
      _mainClient.disconnect();
    } catch (_) {
      // ignore disconnect errors during teardown
    }
  }
  _mainClient = null;

  if (_memoryStore) {
    _memoryStore.clear();
    _memoryStore = null;
  }
  if (_memoryPubSubBus) {
    _memoryPubSubBus.clear();
    _memoryPubSubBus = null;
  }
  Redis = null;
}

const resetRedisForTests = closeRedis;

module.exports = {
  isRedisEnabled,
  enableRedisForTests,
  disableRedisForTests,
  getInstanceId,
  getRedisClient,
  createPubSubClients,
  closeRedis,
  resetRedisForTests,
  setRedisConstructorForTests,
  clearRedisConstructorForTests,
};
