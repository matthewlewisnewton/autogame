# Add tests for session-cookie socket authentication

Create a new test file `game/server/test/websocket_session_auth.test.js` that exercises the session-cookie authentication path in the socket.io middleware. Tests should use `socket.io-client` to connect with a session cookie passed via `extraHeaders`, and verify both successful connections and rejection of invalid/missing sessions.

## Acceptance Criteria

- A new test file `game/server/test/websocket_session_auth.test.js` exists and passes
- Test: valid session cookie → socket connects, `init` fires, `accountId` matches session
- Test: no session cookie AND no JWT token → `connect_error` with appropriate message
- Test: invalid (unknown) session cookie → `connect_error` (not fall-through to anonymous)
- Test: destroyed session → `connect_error` (after calling `destroySession()`)
- Test: valid JWT with no session cookie → still connects (JWT fallback preserved)
- Test: accountId from session is attached to `socket.data.accountId` and visible in `init` payload
- Tests use the same `startTestServer` / `closeTestServer` pattern as `websocket_jwt_auth.test.js`
- Tests create real sessions via `createSession()` from `sessions.js` or via HTTP register/login

## Technical Specs

- **File**: `game/server/test/websocket_session_auth.test.js` (new)
- Import `createSession`, `destroySession` from `sessions.js`; `SESSION_COOKIE_NAME` from `cookies.js`
- Use `socket.io-client` with `extraHeaders: { Cookie: 'ag_session=<token>' }` to pass the session cookie
- Follow the same `beforeEach`/`afterEach` server lifecycle as `websocket_jwt_auth.test.js`
- Use `connectWithAuth`-style helper that accepts `extraHeaders` instead of `auth` object
- Use `connectExpectDisconnect`-style helper for rejection tests

## Verification: code
