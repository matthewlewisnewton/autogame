# Add timer sweep to prune expired rate-limit buckets

The `rateLimitBuckets` Map in `game/server/auth.js` is keyed by `action:ip:username` and entries are never deleted — expired windows are only replaced when the same key recurs. Add a `setInterval` that periodically iterates the Map and deletes entries whose `windowStart` is older than `RATE_LIMIT_WINDOW_MS`.

## Acceptance Criteria

- A `setInterval` is started that runs at a reasonable cadence (e.g., every 60 seconds) and deletes all entries from `rateLimitBuckets` where `Date.now() - bucket.windowStart >= RATE_LIMIT_WINDOW_MS`
- Active (non-expired) buckets are untouched by the sweep
- The sweep interval ID is exported so tests can `clearInterval` it for cleanup
- Rate-limiting behavior for active windows is unchanged (same key generation, same window/attempts logic)

## Technical Specs

- **File:** `game/server/auth.js`
- Add a `pruneExpiredBuckets()` function that iterates `rateLimitBuckets` and `.delete()`s expired entries
- Start a `setInterval(pruneExpiredBuckets, 60_000)` — store the interval ID in a module-level variable
- Export the interval ID as `_rateLimitSweepInterval` (or similar) for test cleanup
- Export `pruneExpiredBuckets` for direct invocation in tests

## Verification: code
