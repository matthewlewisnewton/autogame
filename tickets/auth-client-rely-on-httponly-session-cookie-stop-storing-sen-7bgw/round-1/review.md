# Senior Review — Auth (client): rely on httpOnly session cookie; stop storing/sending the JWT

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `pageerrors: []`, servers started, full deterministic
  flow captured (auth → squad lobby → ready → gameplay → dodge/cooldown).
- `console.log`: no `pageerror`, no `[fatal]` from game code. The two
  `Failed to load resource` lines are benign network responses, not uncaught
  exceptions:
  - `401 (Unauthorized)` — the page-load `GET /api/me` probe before a session
    exists (expected with cookie auth).
  - `409 (Conflict)` — lobby/registration conflict during the capture's
    deterministic register-or-login path.
- The game starts and loads cleanly. Runtime gate PASSES.

## Acceptance criteria

The single AC bundles several requirements; taken point by point:

### Client no longer stores a JWT (no localStorage/sessionStorage token)
PASS. `TOKEN_KEY` const and `storedToken` reader removed from `main.js`;
`getSocketAuthToken()` (which fell back to `localStorage`) removed; the
login-success, account-save, and `patchProfile` paths no longer
`localStorage.setItem(...token)`; `connectionHandlers.js` no longer removes the
token key. `grep` for `TOKEN_KEY` / `autogame_token` in non-test client code:
no hits.

### /api requests succeed via the httpOnly session cookie alone
PASS. `settings.js` `loadAccountSettings`, `patchSettingsImmediate`,
`patchProfile` no longer set an `Authorization: Bearer` header; `GET /api/me`
is now a bare `fetch('/api/me')`. Same-origin fetches send the cookie
automatically. `grep` for `Bearer` in client code: no hits.

### socket.io auth succeeds via the cookie
PASS. `createSocket(options)` no longer takes/sends a token; `io(ioConfig)`
connects same-origin so the cookie rides the WebSocket handshake. The
`fly_replay_client.test.js` assertions confirm `config.auth` is `undefined`.
Server middleware (`server/index.js:1943`) reads `cookies.ag_session` and
authenticates from the session; on no cookie it rejects with a message
(`No JWT token` / `Invalid or expired session`) that the client's
`connect_error` handler matches (`/jwt|token|session|.../i`) to surface the
login overlay.

### Login works end-to-end (cookie set server-side)
PASS. The login handler no longer reads `data.token`; on `res.ok` it calls
`restoreSession()` and clears the forms. The captured run reached full gameplay
through the auth flow, proving login + cookie issuance works.

### A logout action destroys the session
PASS. `performLogout()` now `await fetch("/api/logout", { method: "POST" })`.
The route exists at `server/auth.js:288` (mounted under `/api`,
`server/index.js:1833`) and calls `destroySession(token)` + `clearSessionCookie`,
returning 204 (idempotent on no cookie).

### No Authorization Bearer or socket auth token is sent
PASS. Confirmed by grep (no `Bearer`, no socket `auth:`) and by the unit test
asserting `config.auth` is undefined.

## Consistency / regression

- Consistent with the prior server-side cookie-auth tickets; this completes the
  client migration.
- Unauthenticated page load still reaches the login screen: `restoreSession()`
  swallows the `/api/me` 401, creates a socket, the socket auth fails, and the
  `connect_error` auth path (`connectionHandlers.js:42-59`) shows the auth
  overlay + login form. Functionally correct (see nits for the cleaner path).
- Tests: 209 client tests pass across the changed files (`main.test.js`,
  `fly_replay_client.test.js`, settings). Test updates correctly re-target the
  new behavior (auth overlay on connect_error; `/api/me` fetch mock at setup).

## Remaining gaps

None blocking. A few non-blocking nits are filed in `nits.md`:
- Dead `getAuthToken` import in `main.js`; `getAuthToken`/`setAuthToken` in
  `settings.js` are now no-ops.
- The page-load IIFE's outer `try/catch` is effectively dead because
  `restoreSession()` never throws; the unauthenticated login screen relies on
  the socket `connect_error` path, which causes a brief lobby-browser flash.

VERDICT: PASS
