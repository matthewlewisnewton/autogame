# Fix sweep timer ordering in startServer()

`startRateLimitSweep()` is called at line ~1672 in `startServer()`, but `clearAllTimers()` at line ~1729 calls `stopRateLimitSweep()`, clearing the interval. `restartBackgroundTimers()` does not restart the auth sweep. Move the `startRateLimitSweep()` call to after `restartBackgroundTimers()` so the sweep interval survives server startup.

## Acceptance Criteria

- `startRateLimitSweep()` is called **after** both `clearAllTimers()` and `restartBackgroundTimers()` in `startServer()`
- The old call to `startRateLimitSweep()` before `clearAllTimers()` is removed
- The rate-limit sweep interval is active after `startServer()` completes (verifiable via `_rateLimitSweepInterval` getter or by confirming the interval is not cleared)

## Technical Specs

- **File:** `game/server/index.js`
- Remove the `startRateLimitSweep()` call at line ~1672 (the one before `clearAllTimers()`)
- Add `startRateLimitSweep()` immediately after `restartBackgroundTimers()` at line ~1730

## Verification: code
