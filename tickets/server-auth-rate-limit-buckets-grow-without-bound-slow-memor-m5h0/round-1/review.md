# Senior Review: Server auth rate-limit bucket pruning

**Ticket:** Server: auth rate-limit buckets grow without bound (slow memory exhaustion)  
**Baseline:** `6185007139f434f8d37ed3fd7fce5cb8fac0cffb`  
**Commits:** `b2cb5737` (expiry sweep), `54001dd7` (tests)

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `harness_failure` | absent |
| `console.log` fatal/pageerror | None — only Vite connect logs, expected 409 on duplicate registration, and scene init |

The captured harness run proves the game starts, authenticates, enters gameplay, and completes the movement/dodge smoke flow. No browser page errors.

## Acceptance criteria

### 1. Expired rate-limit buckets are pruned (timer sweep or size cap)

**FAIL — blocking integration bug.**

`pruneExpiredBuckets()` and `startRateLimitSweep()` are implemented correctly in isolation (`game/server/auth.js`), but the sweep never stays running after `startServer()` finishes:

```1668:1730:game/server/index.js
  initAuth();

  // Start periodic sweep to prune expired rate-limit buckets
  startRateLimitSweep();
  // ...
  clearAllTimers();
  restartBackgroundTimers();
```

`clearAllTimers()` calls `stopRateLimitSweep()`, which clears the interval started eight lines earlier. `restartBackgroundTimers()` restarts the game-loop and persistence intervals but does **not** restart the auth sweep. A grep of the repo shows `startRateLimitSweep()` is only invoked at line 1672 — nowhere after `clearAllTimers()`.

**Effect:** In production (and in harness capture), expired `rateLimitBuckets` entries are never deleted by the timer. The original unbounded-growth defect remains for keys that are not revisited after their window expires. The direct-call pruning logic exists but is never scheduled.

**Fix:** Move `startRateLimitSweep()` to after `clearAllTimers()` / `restartBackgroundTimers()`, or add it inside `restartBackgroundTimers()` alongside the other background intervals.

### 2. Rate limiting behavior for active windows unchanged

**PASS (code review).** `isRateLimited()`, `incrementRateLimit()`, and `rateLimitKey()` are untouched. Expiry semantics in `pruneExpiredBuckets()` (`windowStart <= Date.now() - RATE_LIMIT_WINDOW_MS`) match the existing `now - windowStart >= RATE_LIMIT_WINDOW_MS` check. Harness auth + gameplay probes show normal login and play with no 429 regressions on the smoke path.

### 3. A test covers pruning

**PARTIAL PASS.** Three unit tests in `game/server/test/auth.test.js` cover `pruneExpiredBuckets()` directly (expired removal, active preservation, mixed). These pass and correctly exercise the pruning function.

The fourth test ("sweep interval is active after server starts") does **not** verify post-`startServer()` behavior. It calls `startRateLimitSweep()` again in the test body, which masks the ordering bug above because `clearAllTimers()` had already stopped the interval and `_rateLimitSweepInterval` was null.

## Design & requirements consistency

**PASS.** This is a server-only memory-hygiene fix for auth rate limiting. No changes to client gameplay, dungeon logic, or multiplayer flows. `game/docs/design.md` and `game/docs/requirements.md` impose no conflicting constraints. No debug scenarios were added or modified.

## Code quality

- **Pruning implementation:** Clean, idempotent `startRateLimitSweep` / `stopRateLimitSweep` pair; `stopRateLimitSweep` correctly wired into `clearAllTimers()` for test teardown.
- **Exports:** Test helpers (`_rateLimitBuckets`, `pruneExpiredBuckets`, `_rateLimitSweepInterval` getter) are appropriately scoped.
- **Sweep cadence:** 60 s interval vs 60 s default window is reasonable; worst-case expired-entry retention is ~2 minutes, acceptable once the timer actually runs.
- **Tests:** Full suite passes (3974 tests). Coverage log shows the new `pruneExpiredBuckets` describe block executed.

## Debug scenarios

Not applicable — this ticket did not add or change any `?debugScenario=` shortcuts.

## Remaining gaps

1. **Sweep timer stopped during server startup** — `startRateLimitSweep()` is called before `clearAllTimers()`, so the periodic prune never runs on a live server. The ticket's primary goal (prevent unbounded Map growth from expired keys) is not achieved in production.

## Nits (non-blocking)

See `nits.md` if present — the interval test should assert sweep survival after `startServer()` completes, not re-call `startRateLimitSweep()` manually.

VERDICT: FAIL
