# Remove MaxListenersExceededWarning in integration tests

The coverage log includes a `MaxListenersExceededWarning` during socket integration tests. Fix listener lifecycle or raise the limit on the shared `io` singleton so test output is clean.

## Acceptance Criteria
- Running `pnpm test` from `game/` no longer emits `MaxListenersExceededWarning` to stderr.
- All existing integration tests still pass and cover the same socket connection and gameplay flows.
- No other changes — do not touch production server logic beyond the `io` singleton's listener limit, and do not modify client code.

## Technical Specs
- **Files to change:** `game/server/index.js` (set `io.setMaxListeners(0)` or a high value at module level) and/or `game/server/test/integration.test.js` (ensure `closeServer()` calls `serverIo.removeAllListeners()` after closing)
- The `io` and `httpServer` objects are module-level singletons reused across all integration tests. Even though `removeAllListeners('connection')` is called before each `startServer()`, other events on the `io` singleton (e.g., `connect`, `disconnect`) may accumulate across test iterations and exceed Node's default limit of 17.
- Two approaches are acceptable:
  1. Call `serverIo.setMaxListeners(0)` (unlimited) right after creating the `io` instance in `index.js` — simplest and matches the fact that listeners are cleaned up between tests.
  2. In `closeServer()`, call `serverIo.removeAllListeners()` (no argument) to strip all event listeners, not just `'connection'`.
- Either approach is fine; pick the one that eliminates the warning with minimal diff.
- No other changes.

## Verification: code
