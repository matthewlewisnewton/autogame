# Fix sweep interval test to verify post-startServer behavior

The existing "sweep interval is active after server starts" test re-calls `startRateLimitSweep()` manually in the test body, which masks the ordering bug (the interval was already cleared by `clearAllTimers()`). Fix the test to verify that the sweep survives `startServer()` without re-invoking the start function.

## Acceptance Criteria

- The sweep-interval test does **not** call `startRateLimitSweep()` directly — it relies on `startTestServer()` (which calls `startServer()`) to have started the sweep
- The test asserts that `_rateLimitSweepInterval` is a truthy value after `startTestServer()` completes, proving the sweep survived the full startup sequence
- All existing auth tests continue to pass

## Technical Specs

- **File:** `game/server/test/auth.test.js`
- In the `rate-limit sweep interval` describe block, replace the test that calls `startRateLimitSweep()` with one that checks the exported `_rateLimitSweepInterval` getter after `startTestServer()` (already called in `beforeEach`)
- If `_rateLimitSweepInterval` is not exported from `auth.js` for reading, add a getter export

## Verification: code
