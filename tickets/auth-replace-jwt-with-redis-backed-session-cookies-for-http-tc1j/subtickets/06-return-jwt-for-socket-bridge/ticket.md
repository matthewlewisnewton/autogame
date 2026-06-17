# Return JWT token alongside session cookie for socket bridge

Sub-ticket 03 removed the JWT `token` from `/api/login` and `/api/register` response bodies, but the client (`main.js`) and Socket.IO handshake (`index.js`) still require that body token for socket auth. Restore issuing a JWT in the JSON response **in addition to** the httpOnly session cookie so HTTP auth stays cookie-primary while the legacy socket path keeps working until a later migration bead.

## Acceptance Criteria

- Successful `POST /api/register` (201) returns `{ accountId, token }` where `token` is a non-empty JWT string, **and** still sets the httpOnly session cookie and creates the Redis session record.
- Successful `POST /api/login` (200) returns `{ accountId, token }` with a valid JWT, **and** still sets the session cookie and creates/refreshes the Redis session.
- The JWT payload includes `{ accountId, username }`, is signed with `getJWTSecret()` / `JWT_EXPIRATION` (`24h`), and passes `verifyToken()` — same contract the socket middleware already enforces.
- Session cookie behavior is unchanged: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` only in production; `requireAuth` continues to validate via cookie, not the body JWT.
- `game/server/test/auth.test.js` login/register success tests assert `data.token` is present and `jwt.verify(data.token, getJWTSecret())` decodes to the correct `accountId`/`username`, while still asserting the session cookie and Redis session exist.
- Harness smoke capture can complete login and reach the lobby browser (`#lobby-browser` visible) — the login flow no longer silently fails on missing `data.token`.

## Technical Specs

- **`game/server/auth.js`**
  - After `createSession` + `setSessionCookie` on register (~lines 217–219), also `jwt.sign({ accountId: result.accountId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRATION })` and include `token` in `res.status(201).json({ accountId, token })`. Use the request `username` string (already validated).
  - After `createSession` + `setSessionCookie` on login (~lines 266–268), sign the same `{ accountId, username }` JWT and return `res.status(200).json({ accountId, token })`.
  - Do **not** remove session-cookie creation or change logout/requireAuth paths. Do **not** change `verifyToken`, socket middleware, or client code in this sub-ticket.
  - Update route JSDoc comments to document the dual response shape.
- **`game/server/test/auth.test.js`**
  - In register/login success tests (and any other tests that currently `expect(data.token).toBeUndefined()`), replace with assertions that `data.token` is defined, is a string, and `jwt.verify` succeeds with matching `accountId`/`username`.
  - Keep all existing session-cookie and `getSession` assertions intact.
- **No client changes** — `game/client/main.js` already gates login success on `data.token` and passes it to `createSocket` via `restoreSession`.

## Verification: code
