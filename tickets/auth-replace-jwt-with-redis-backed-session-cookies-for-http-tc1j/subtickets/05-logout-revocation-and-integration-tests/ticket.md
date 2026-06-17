# Logout, session revocation, and cookie-based HTTP test helpers

Add `POST /api/logout` to destroy the server-side session and clear the cookie, proving revocation works. Update remaining server integration tests that still expect a JWT from `/api/login` so the full auth test suite passes with cookie-based HTTP auth.

## Acceptance Criteria

- `POST /api/logout` with a valid session cookie destroys the Redis session and clears the cookie via `Set-Cookie`.
- After logout, `GET /api/me` with the same cookie (or a replay of the old token) returns 401.
- Logout with no cookie is safe (204 or 401 — pick one and document; prefer 204 no-op or 401 if strict).
- `hub_presence_integration.test.js`, `cosmetic_runtime.test.js`, and `apply_appearance_change.test.js` authenticate via session cookie instead of `Authorization: Bearer ${token}` from login JSON.
- `pnpm test:quick` (or targeted server auth/account/integration tests) passes with no regressions to JWT WebSocket tests (`websocket_jwt_auth.test.js`, `multi_instance_jwt.test.js`).

## Technical Specs

- **`game/server/auth.js`**
  - Add `POST /logout` route: read token from `getSessionTokenFromRequest`, `destroySession(token)`, `clearSessionCookie(res)`, return appropriate status.
- **`game/server/test/auth.test.js`**
  - Add describe block for logout: login → cookie works on `/api/me` → logout → `/api/me` 401.
  - Add explicit revocation test: session key absent in Redis after logout.
- **`game/server/test/helpers.js`** (or shared test util)
  - Optional: export `registerAndLoginWithCookie(baseUrl)` returning `{ accountId, sessionToken, cookieHeader }` for reuse across integration tests.
- **`game/server/test/hub_presence_integration.test.js`**, **`game/server/test/cosmetic_runtime.test.js`**, **`game/server/test/apply_appearance_change.test.js`**
  - Replace Bearer headers sourced from `loginRes.json().token` with cookie header from `Set-Cookie`.

## Verification: code
