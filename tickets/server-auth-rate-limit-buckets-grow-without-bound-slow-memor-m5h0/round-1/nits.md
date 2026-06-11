## Strengthen rate-limit sweep interval test

The test "sweep interval is active after server starts" calls `startRateLimitSweep()` manually, which masks the bug where `clearAllTimers()` in `startServer()` stops the sweep before the server is ready. The test should assert `_rateLimitSweepInterval` is non-null immediately after `startTestServer()` / `startServer()` without re-starting the sweep.

### Acceptance Criteria
- After `startServer(0)` returns, `auth._rateLimitSweepInterval` (or equivalent export) is truthy without calling `startRateLimitSweep()` again in the test.
- Test fails if `startRateLimitSweep()` is placed before `clearAllTimers()` in `startServer()`.
