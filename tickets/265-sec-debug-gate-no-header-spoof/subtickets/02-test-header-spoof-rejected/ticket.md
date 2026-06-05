# 02-test-header-spoof-rejected

Add a unit test confirming that spoofed Origin/Host headers cannot enable debug scenarios. The test creates a mock socket with a non-loopback peer address but localhost-looking Origin and Host headers, then asserts `isDebugScenarioAllowed()` returns `false`.

## Acceptance Criteria

- A new test file or test block exists under `game/server/test/` that exercises `isDebugScenarioAllowed()` with spoofed headers
- Test case: socket with `handshake.address = '1.2.3.4'` (or similar non-loopback) and `handshake.headers.origin = 'http://localhost'`, `handshake.headers.host = 'localhost'` — result is `false`
- Test case: socket with loopback address (`::1` or `127.0.0.1`) — result is `true` (regression guard)
- Test runs with `ALLOW_DEBUG_SCENARIOS` unset and `NODE_ENV` not `production`
- Test passes when added to the suite (`pnpm test`)

## Technical Specs

- **File:** `game/server/test/debug-scenarios.test.js` — add a new `describe('isDebugScenarioAllowed header spoofing')` block (or a dedicated `game/server/test/debug-gate.test.js`)
- Import or require the `isDebugScenarioAllowed` function from `game/server/index.js`, or construct a minimal Socket.IO mock socket object with `handshake.address` and `handshake.headers`
- Ensure env vars are cleaned in `beforeEach`/`afterEach` so the test doesn't leak state

## Verification: code
