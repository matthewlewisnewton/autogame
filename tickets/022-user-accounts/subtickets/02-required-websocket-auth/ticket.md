# Require WebSocket Authentication

Remove the anonymous WebSocket fallback — every Socket.IO connection must present a valid JWT token. Reject tokenless handshakes immediately so that gameplay state is always tied to an authenticated account.

## Acceptance Criteria
- `game/server/index.js` — the Socket.IO `connection` handler reads `socket.handshake.auth.token`.
- When **no token** is provided, the server calls `socket.disconnect()` immediately (no player created, no `init` emitted).
- When an **invalid/expired** token is provided, the server calls `socket.disconnect()` immediately.
- When a **valid** token is provided, the server uses the decoded `accountId` as the player identity and proceeds with normal connection lifecycle.
- `game/client/main.js` — on page load, if no token exists in `localStorage`, the client **does not** attempt a Socket.IO connection; it shows the auth overlay and waits for the user to log in.
- After successful login (token obtained), the client creates the Socket.IO connection with `{ auth: { token } }`.
- Unit tests cover: tokenless disconnect, invalid token disconnect, and valid token acceptance.

## Technical Specs
- **Modify**: `game/server/index.js` — in `io.on('connection', ...)`, remove the anonymous fallback branch. If `!token || !verifyToken(token)`, call `socket.disconnect()` and return. Only proceed to player creation after successful verification.
- **Modify**: `game/client/main.js` — guard the initial `createSocket()` call: only invoke it when `storedToken` is truthy. When no token, skip socket creation entirely and show the auth overlay. After login, call `createSocket(data.token)`.
- **Modify**: `game/server/test/websocket_jwt_auth.test.js` — update tests to assert that tokenless connections are disconnected (not accepted as anonymous).

## Verification: code
