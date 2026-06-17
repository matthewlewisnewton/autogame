# Remove remaining JWT references in docs and admin comments

Round-2 review found three stale JWT references left after the server runtime migration. Rewrite them to describe the live session-cookie auth (`ag_session`) so documentation and inline comments match actual behavior.

## Acceptance Criteria

- **`game/docs/gameplay-review.md`** — The "Authentication and lobby browser" paragraph (~L9) no longer mentions storing a JWT or server token validation. It describes that `/api/register` or `/api/login` sets an httpOnly `ag_session` cookie, the client opens Socket.IO via `createSocket()` in `game/client/main.js` with `withCredentials`, and the server's `io.use()` middleware validates the cookie via `getSession()`; a missing or invalid session yields `connect_error` and the client re-shows login.
- **`game/docs/lobbies.md`** — The Fly.io lobby-affinity paragraph (~L131) says handshakes are routed "before session auth" (or equivalent session-cookie wording), not "before JWT auth".
- **`game/server/admin.js`** — The file-header comment (~L3) and `requireAdminPassword` JSDoc (~L201) contrast admin auth with **player session auth** (`ag_session` cookie), not "player JWT auth" or `Authorization: Bearer`.
- `rg -i 'JWT|jsonwebtoken|Bearer' game/docs/gameplay-review.md game/docs/lobbies.md game/server/admin.js` returns no matches (except none expected — zero hits required).
- No game runtime code, tests, or harness files are modified; documentation and comments only.

## Technical Specs

- **`game/docs/gameplay-review.md`**
  - Replace the JWT paragraph under "### Authentication and lobby browser" with session-cookie flow grounded in `game/server/index.js` (`io.use` reads `cookies.ag_session`, calls `getSession`, rejects with `Missing or invalid session` / `Invalid or expired session`) and `game/server/auth.js` (`setSessionCookie` on register/login).
  - Keep the following paragraph about `lobbies.registerSession` and lobby browser behavior unchanged unless a pronoun must be adjusted for the new auth wording.
- **`game/docs/lobbies.md`**
  - In the "Fly.io lobby affinity" section (~L131), change `before JWT auth` → `before session auth` (or `before the session-cookie auth middleware`).
- **`game/server/admin.js`**
  - Line ~3: replace `player JWT auth` / `Authorization: Bearer` / `player token` with player **session** auth via the `ag_session` cookie; note admin middleware does not read that cookie for player identity.
  - Line ~201 JSDoc: replace `player JWT / Authorization: Bearer header` with player session cookie (`ag_session`) wording.

## Verification: code
