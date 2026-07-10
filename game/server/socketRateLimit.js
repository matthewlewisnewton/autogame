const DEFAULT_POLICY = Object.freeze({ refillPerSecond: 30, burst: 60 });
const EVENT_POLICIES = Object.freeze({
  move: { refillPerSecond: 60, burst: 120 },
  heartbeat: { refillPerSecond: 2, burst: 5 },
  listLobbies: { refillPerSecond: 2, burst: 5 },
});

function allowSocketEvent(socket, event, now = Date.now()) {
  if (!socket || event === 'disconnect') return true;
  if (!socket.data) socket.data = {};
  if (!socket.data._eventRateLimits) socket.data._eventRateLimits = new Map();

  const policy = EVENT_POLICIES[event] || DEFAULT_POLICY;
  let bucket = socket.data._eventRateLimits.get(event);
  if (!bucket) {
    bucket = { tokens: policy.burst, updatedAt: now };
    socket.data._eventRateLimits.set(event, bucket);
  }

  const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(
    policy.burst,
    bucket.tokens + elapsedSeconds * policy.refillPerSecond,
  );
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    socket.data._eventRateLimitDrops = (socket.data._eventRateLimitDrops || 0) + 1;
    return false;
  }

  bucket.tokens -= 1;
  return true;
}

module.exports = {
  allowSocketEvent,
  DEFAULT_POLICY,
  EVENT_POLICIES,
};
