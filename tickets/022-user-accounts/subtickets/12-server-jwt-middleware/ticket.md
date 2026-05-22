# Move JWT Rejection to Socket.IO Middleware

The server currently rejects invalid/missing JWTs from inside the `connection` handler, which produces a client-side `connect` followed by `disconnect: io server disconnect`. The client's `connect_error` handler never fires, so a returning user with an expired token is left stuck outside the login flow.

Move JWT validation into a Socket.IO middleware (`io.use()`) so that failed authentication happens *before* the `connect` event fires. Socket.IO middleware that calls `next(new Error(...))` triggers a `connect_error` on the client — which the existing client handler already clears the token and re-shows the login overlay.

## Acceptance Criteria
- `game/server/index.js` — JWT validation is performed in an `io.use()` middleware callback, not inside `io.on('connection', ...)`.
- When a socket connects with **no token**, the middleware calls `next(new Error('No JWT token'))` — the client receives `connect_error`, not `connect`.
- When a socket connects with an **invalid or expired token**, the middleware calls `next(new Error('Invalid or expired JWT'))` — the client receives `connect_error`.
- When a socket connects with a **valid token**, the middleware calls `next()` — the `connection` handler proceeds normally.
- The `connection` handler no longer performs its own JWT check (it trusts the middleware to have already validated).
- The `connection` handler reads `socket.data.accountId` and `socket.data.username` set by the middleware instead of re-verifying the token.
- Existing behavior for anonymous (no-token) connections is preserved: they are rejected, not accepted.

## Technical Specs
- **File**: `game/server/index.js`
  - Add `io.use((socket, next) => { ... })` before `io.on('connection', ...)`.
  - In the middleware: read `socket.handshake.auth.token`; if missing, call `next(new Error('No JWT token'))`. If `verifyToken(token)` returns null, call `next(new Error('Invalid or expired JWT'))`. Otherwise, set `socket.data.accountId = decoded.accountId` and `socket.data.username = decoded.username`, then call `next()`.
  - In the `connection` handler: replace the inline JWT verification block with `const accountId = socket.data.accountId; const username = socket.data.username;` — no more `verifyToken()` call or `socket.disconnect()` for auth failures.
  - Keep the rest of the connection handler (player creation, persistence load, event binding) unchanged.

## Verification: code
