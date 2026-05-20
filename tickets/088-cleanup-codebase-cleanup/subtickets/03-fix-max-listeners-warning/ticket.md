# Remove MaxListenersExceededWarning in integration tests

The coverage log includes a `MaxListenersExceededWarning` during socket integration tests. The warning originates from `httpServer` (the Node.js HTTP server), not the Socket.IO `io` singleton — each call to `startTestServer()` stacks a `once('error')` listener that accumulates across test iterations.

Raise the listener limit on `httpServer` to eliminate the warning with a one-line change.

## Acceptance Criteria
- Running `pnpm test` from `game/` no longer emits `MaxListenersExceededWarning` to stderr.
- All existing integration tests still pass and cover the same socket connection and gameplay flows.
- No other changes — do not touch client code, do not modify test file logic beyond what is necessary, and do not alter production server behavior.

## Technical Specs
- **Files to change:** `game/server/index.js` — add `server.setMaxListeners(0)` at module level, right after the `io` instance is created (around line 28).
- The `server` variable is the `http.createServer()` result. Setting `setMaxListeners(0)` on it (unlimited) is safe because:
  - `startTestServer()` in `integration.test.js` adds `httpServer.once('error', …)` and `httpServer.once('listening', …)` listeners each test — these are `once` listeners that auto-remove after firing, but the accumulation during a long test run still triggers Node's default cap of 10.
  - The `server` is a module-level singleton reused across all tests; listeners are cleaned up between tests via `closeServer()`.
- Alternative (also acceptable): add `httpServer.removeAllListeners('error')` in `closeServer()` in `integration.test.js`, but the `setMaxListeners(0)` approach is a single-line change in one file.
- No other changes.

## Verification: code
