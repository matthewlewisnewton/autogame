# Senior Review: Server auth rate-limit bucket pruning

**Ticket:** Server: auth rate-limit buckets grow without bound (slow memory exhaustion)  
**Baseline:** `6185007139f434f8d37ed3fd7fce5cb8fac0cffb`  
**Commits:** 4 (`01-add-expiry-sweep`, `02-test-pruning`, `01-fix-sweep-timer-ordering`, `02-fix-sweep-interval-test`)

## Runtime health

Captured run is healthy:

- `metrics.json`: `"ok": true`, empty `pageerrors`, four gameplay screenshots, probes show connected two-player dungeon session (`phase: "playing"`, canvas present, movement/dodge exercised).
- `console.log`: no `pageerror` or `[fatal]` lines. Benign harness noise only (Vite connect, HTTP 409 on duplicate registration attempts during smoke setup).
- `pageerrors.json`: `[]`
- Server log shows normal startup, socket connections, quest deploy, clean SIGTERM shutdown.

The game starts and loads cleanly. No harness infrastructure failure.

## Acceptance criteria

### Expired rate-limit buckets are pruned (timer sweep or size cap)

**Met.** `game/server/auth.js` adds:

- `pruneExpiredBuckets()` — iterates `rateLimitBuckets` and deletes entries where `bucket.windowStart <= Date.now() - RATE_LIMIT_WINDOW_MS` (equivalent to the existing expiry check in `isRateLimited`).
- `startRateLimitSweep()` — idempotent `setInterval(pruneExpiredBuckets, 60_000)`.
- `stopRateLimitSweep()` — clears the interval; wired into `clearAllTimers()` in `game/server/index.js` so test restarts do not leak timers.

`startRateLimitSweep()` is called in `startServer()` **after** `clearAllTimers()` and `restartBackgroundTimers()` (line ~1730), fixing the ordering bug caught in sub-ticket review where an earlier call was immediately cleared on startup.

### Rate limiting behavior for active windows unchanged

**Met.** `isRateLimited`, `incrementRateLimit`, `rateLimitKey`, window/attempt constants, and route handlers are untouched. Expiry semantics in `pruneExpiredBuckets` match the `>= RATE_LIMIT_WINDOW_MS` boundary used by `isRateLimited` when deciding whether a bucket is stale.

Test mode bypass (`NODE_ENV === 'test'` without `AUTH_RATE_LIMIT_IN_TESTS=1`) is unchanged. Full suite: 3974 tests passed (re-run locally; round-2 `coverage.log` also shows pruning tests green).

### A test covers pruning

**Met.** `game/server/test/auth.test.js` adds:

1. Three direct `pruneExpiredBuckets()` cases — expired-only removal, active preservation, mixed batch.
2. One `rate-limit sweep interval` case asserting `getRateLimitSweepInterval()` is truthy after `startTestServer()` / `startServer()`, without manually re-calling `startRateLimitSweep()` (validates startup wiring).

Tests use `createRequire` to read the same CJS `auth.js` instance that `index.js` uses, avoiding Vitest dual-module-instance drift.

## Design & regression

- **design.md:** No conflict. Server-side auth memory hygiene; no gameplay or client changes.
- **requirements.md foundation:** No regressions observed. Auth overlay, JWT socket gate, and lobby/deploy flow all exercised in capture.
- **Debug scenarios:** None added or modified — N/A.

## Code quality

- Focused diff (~90 lines production, ~75 lines tests across `auth.js` and `index.js`).
- Idempotent start/stop, safe Map iteration during delete, exports scoped for tests (`pruneExpiredBuckets`, `getRateLimitSweepInterval`, `_rateLimitBuckets`).
- Sub-ticket timer-ordering fix is correct and covered by the interval test.
- No dead code or obvious bugs in the pruning path.

**Minor observation (non-blocking):** A one-shot unique `action:ip:username` key can linger up to ~window + sweep interval (~120s with defaults) before the timer removes it, since `isRateLimited` only replaces a bucket when the same key recurs. This matches the ticket's 60s sweep cadence example and still bounds memory versus unbounded growth.

## Remaining gaps

None. All acceptance criteria are satisfied; runtime capture and tests confirm the fix.

VERDICT: PASS
