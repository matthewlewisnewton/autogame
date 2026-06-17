# Add session-cookie authentication path to socket.io middleware

Modify the `io.use()` middleware in `game/server/index.js` to authenticate socket connections via the session cookie (`ag_session`) read from `socket.handshake.headers.cookie`. The middleware should attempt session-cookie auth first, then fall back to the existing JWT path (which must remain for backward compatibility until the client is migrated).

When a valid session is found, look up the user record to obtain the username and set `socket.data.accountId` / `socket.data.username`. Reject with `connect_error` when the session token is missing, unknown, or destroyed. Keep the existing safe-accountId guard (`/^[A-Za-z0-9_-]+$/`).

## Acceptance Criteria

- The `io.use()` middleware reads the `ag_session` cookie from `socket.handshake.headers.cookie`
- A valid session token resolves to an `accountId` via `getSession()` from `sessions.js`
- The username is resolved via `findUserByAccountId()` from `users.js` and attached as `socket.data.username`
- `socket.data.accountId` is set from the session's `accountId`
- The accountId passes the safe-accountId regex guard (`/^[A-Za-z0-9_-]+$/`); invalid shapes are rejected with `connect_error`
- Missing cookie → falls through to JWT auth path (no new error, just fallback)
- Present but invalid/destroyed session token → rejected with `connect_error` (do NOT fall through to JWT)
- Expired session (Redis TTL elapsed) → rejected with `connect_error`
- Existing JWT auth path is PRESERVED and works as a fallback when no session cookie is present
- Works with both Redis backend and in-memory shim (uses existing `getSession()` which handles both)

## Technical Specs

- **File**: `game/server/index.js` — modify the `io.use()` middleware block (~lines 1932–1965)
- Use `parseCookies()` from `cookies.js` to extract `ag_session` from the raw cookie header string
- Use `getSession(token)` from `sessions.js` (already exported, async, returns `null` for missing/expired)
- Use `findUserByAccountId(accountId)` from `users.js` to resolve username
- The middleware is guarded by `!_middlewareRegistered` — do NOT change this guard; modify the callback body in place
- Error messages for rejected sessions should mention "session" so the client `connect_error` handler can distinguish them

## Verification: code
