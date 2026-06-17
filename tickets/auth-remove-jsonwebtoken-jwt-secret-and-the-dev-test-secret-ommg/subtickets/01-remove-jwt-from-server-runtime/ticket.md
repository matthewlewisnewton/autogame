# Remove JWT from server runtime (session-only auth)

Strip all JWT issuance, verification, and secret handling from the server. HTTP register/login and Socket.IO must rely exclusively on the existing httpOnly session cookie (`ag_session`); responses must no longer include a `token` field.

## Acceptance Criteria

- `jsonwebtoken` is removed from `game/server/package.json` and `pnpm-lock.yaml` is updated (run `pnpm install` in `game/`).
- `game/server/auth.js` has no `jsonwebtoken` import, no `JWT_SECRET` / `dev-secret` / `test-secret` logic, and no `verifyToken`, `getJWTSecret`, or `resetAuthSecret` exports.
- `POST /api/register` and `POST /api/login` still set the session cookie but return JSON without a `token` field (e.g. `{ accountId }` only).
- `game/server/account.js` no longer imports or signs JWTs (remove `payload.token` on username change).
- `game/server/index.js` socket `io.use` middleware accepts **only** session-cookie auth; the JWT fallback block (`socket.handshake.auth.token`, `verifyToken`) is deleted.
- `startServer()` no longer calls a JWT-secret `initAuth()`; the server boots in production without `JWT_SECRET` or `ALLOW_DEV_AUTH`.
- `verifyToken` and `getJWTSecret` are removed from `index.js` test exports.
- `rg -i 'jsonwebtoken|JWT_SECRET|verifyToken|getJWTSecret|resetAuthSecret|dev-secret|test-secret' game/server --glob '!test/**'` returns no matches.

## Technical Specs

- **`game/server/auth.js`**
  - Delete `jsonwebtoken` require, `JWT_SECRET`, `JWT_EXPIRATION`, `initAuth()`, `verifyToken()`, `getJWTSecret()`, `resetAuthSecret()`.
  - Remove `jwt.sign(...)` from `/register` and `/login`; keep `createSession` + `setSessionCookie`.
  - Remove JWT-related module exports; keep rate-limit helpers (`startRateLimitSweep`, etc.).
- **`game/server/account.js`**
  - Remove `jsonwebtoken` require, `getJwtSecret()`, `JWT_EXPIRATION`, and the `payload.token = jwt.sign(...)` branch in `PATCH /me/profile`.
- **`game/server/index.js`**
  - Drop `verifyToken`, `initAuth`, `getJWTSecret` imports from `./auth`; remove `initAuth()` call in `startServer()`.
  - In `io.use` middleware: after session-cookie validation fails or cookie is absent, return `next(new Error('Missing or invalid session'))` — do not fall through to JWT.
  - Update comments that still describe JWT auth.
  - Remove `verifyToken` / `getJWTSecret` from the test export object at the bottom.
- **`game/server/package.json`**
  - Remove the `jsonwebtoken` dependency entry.

## Verification: code
