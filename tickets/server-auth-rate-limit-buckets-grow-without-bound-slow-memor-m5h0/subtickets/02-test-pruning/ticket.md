# Test coverage for rate-limit bucket pruning

Add unit tests that verify the expiry sweep correctly removes expired buckets while leaving active ones intact, and that the sweep interval is running.

## Acceptance Criteria

- Test that calling `pruneExpiredBuckets()` removes entries older than `RATE_LIMIT_WINDOW_MS` from `rateLimitBuckets`
- Test that entries still within their window are preserved after a prune
- Test that the sweep interval is active (non-zero interval ID) after auth module loads
- All existing server tests continue to pass

## Technical Specs

- **File:** `game/server/tests/auth.test.js` (or existing auth test file — add a new describe block)
- Use `_resetRateLimits()` to clear state before each test
- Manually insert buckets with backdated `windowStart` values to simulate expired entries
- Call the exported `pruneExpiredBuckets()` directly (no need to wait for the timer)
- Assert Map size and key presence/absence after pruning

## Verification: code
