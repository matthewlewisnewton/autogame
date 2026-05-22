# Integration Test: Client JWT Recovery Flow

Add a real client/server integration test that proves the full JWT recovery cycle: connecting with a bad token triggers `connect_error`, the client clears the stale token, and the user is returned to the login overlay.

## Acceptance Criteria
- A new test file `game/server/test/jwt_recovery.test.js` (or a test block in an existing auth test file) covers the end-to-end flow.
- The test starts a real server (`startServer()` on a test port) and connects a real Socket.IO client with an **invalid** token (e.g., a token signed with the wrong secret, or a manually expired token).
- The client socket receives a `connect_error` event (not `connect` followed by `disconnect`).
- A second test connects with **no token** and also receives `connect_error`.
- A third test connects with a **valid** token and receives `connect` (happy path).
- All tests pass without modifying existing test files.

## Technical Specs
- **File**: `game/server/test/jwt_recovery.test.js`
  - Use `startServer()` from `game/server/index.js` on an ephemeral port.
  - Use the Socket.IO client (`import { io } from 'socket.io-client'`) to create connections with:
    1. `{ auth: { token: 'invalid-token' } }` — assert `connect_error` fires, `connect` does not.
    2. `{ auth: {} }` (no token) — assert `connect_error` fires.
    3. `{ auth: { token: validToken } }` — assert `connect` fires and `init` is emitted.
  - For the valid token, use `jwt.sign({ accountId: 'test', username: 'test' }, secret)` with the test secret from `getJWTSecret()`.
  - Clean up: disconnect sockets and call `stopServer()` (or close the HTTP server) in `afterEach`.
  - Use the same test isolation pattern as existing auth tests (temp user file path, `setTestFilePath`).

## Verification: code
