# Senior Review — Auth: replace JWT with Redis-backed session cookies (HTTP)

## Runtime health — BROKEN (blocking)

`metrics.json` reports `"ok": false`, `failure_kind: "capture_failed"`. There is
**no** `harness_failure` block and `pageerrors` is empty, and both dev servers
started cleanly (vite on :5178, game server on :3005). So this is **not** infra
and **not** a browser page error — the capture failed because the game's own
**login flow is broken end-to-end**:

- `screenshot.log`: the smoke flow registered (409 = username already taken,
  expected — 4 persisted users), then could never reach the lobby:
  `#lobby-browser not visible for player A, waiting…` → timeout; `#create-lobby-name`
  never became visible.
- `console.log`: `409 (Conflict)` then `page.waitForFunction: Timeout 12000ms exceeded`.

Root cause (verified in the working tree):

1. `game/server/auth.js:268` — `/api/login` now returns only `{ accountId }`,
   with **no `token`** in the body (same for `/api/register` at line 219). This
   matches the ticket's "Set-Cookie INSTEAD of returning a JWT in the body."
2. `game/client/main.js:3859` — the client login handler is
   `if (res.ok && data.token) { localStorage.setItem(TOKEN_KEY, data.token); await restoreSession(data.token); }`.
   With `data.token` now `undefined`, the success branch never runs: the socket
   is never created and the lobby browser never appears. Login silently fails.
3. `game/server/index.js:1937-1943` — the Socket.IO handshake **still**
   authenticates with `socket.handshake.auth.token` + `verifyToken()` (JWT), and
   `game/client/main.js:1204-1213` still passes `auth: { token }` from the
   JWT in localStorage.

The ticket explicitly says "Do NOT remove JWT code yet (a later bead does that
after socket+client migrate)." But removing the JWT from the login/register
**response body** — while the socket and client still depend on that body token
— strands the client: a real player can no longer log in or connect. The
captured run is the proof; this is a blocking integration regression regardless
of how clean the new server modules are.

## Per-criterion findings

**Cookie set on login/register (httpOnly, SameSite=Lax, Secure in prod).**
Met at the HTTP layer. `cookies.js:setSessionCookie` emits `Path=/; HttpOnly;
SameSite=Lax` and adds `Secure` only when `NODE_ENV==='production'`; wired into
both endpoints (`auth.js:218`, `auth.js:267`). Good.

**Redis session created; create/get/destroy/refresh with sliding TTL.**
Met. `sessions.js` generates `crypto.randomBytes(32).toString('base64url')`,
stores `session:<token>` hash `{accountId, createdAt, lastSeen}`, sets a
86400s TTL, and refreshes TTL + `lastSeen` on every `getSession`/`refreshSession`.
No signing secret needed. Backed by the in-memory Redis shim when `REDIS_URL`
is unset.

**requireAuth validates via cookie; 401 when missing/expired/destroyed.**
Met. `account.js:28-50` reads the cookie token, looks it up in Redis, 401s on
missing/invalid, validates the accountId shape, and sets `req.accountId`/`req.username`.

**POST /api/logout destroys session + clears cookie (revocation works).**
Met at the HTTP layer. `auth.js:276-288` destroys the session and clears the
cookie; idempotent 204 when no cookie.

**Shared across instances via Redis / in-memory shim; tests updated & passing.**
Server unit tests pass: `auth.test.js`, `sessions.test.js`, `cookies.test.js`,
`account.test.js` → **69 passed**. The new modules are well-tested in isolation.

**BUT — the criteria are not robustly met at the system level.** The acceptance
criterion is about HTTP auth, and the HTTP unit tests are green, but the change
breaks the only way a player actually obtains a session in the running game
(the browser UI), because login no longer yields the JWT the still-present
socket auth path requires. "Auth tests updated and passing" is satisfied for
the new HTTP tests but the integrated login→socket→lobby flow regressed.

## Consistency with design / foundation

The Redis session module is consistent with the stated direction (opaque
server-side sessions, revocation, no signing secret). The regression is a
foundation regression: a working login→lobby flow (requirements baseline) no
longer works in the captured run.

## Code quality

- New modules (`sessions.js`, `cookies.js`) are clean and well-scoped.
- `account.js` still imports `jwt` and signs a fresh token on username change
  (`account.js:142`) — intentional, JWT not removed yet. Not a blocker.
- Dev scripts under `game/client/scripts/*.mjs` read `body.token` from
  login/register and will also break, but those are out-of-band dev tools, not
  the shipped client.

## Remaining gaps

1. **Login is broken in the running game** — `/api/login` (and `/api/register`)
   no longer return a `token` in the body, but the client (`main.js:3859`) and
   the Socket.IO handshake (`index.js:1937`, JWT via `verifyToken`) still require
   it. Players cannot log in or connect; the capture timed out at the lobby step.
   Fix: continue returning the JWT `token` in the login/register response body
   (in addition to setting the session cookie) until the later socket-migration
   bead lands. The cookie stays primary for HTTP `requireAuth`; the body token
   keeps the legacy socket/client path working so the game runs.

VERDICT: FAIL
