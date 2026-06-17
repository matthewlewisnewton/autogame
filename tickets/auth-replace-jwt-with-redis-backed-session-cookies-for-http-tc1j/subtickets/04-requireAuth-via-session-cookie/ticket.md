# `requireAuth` validates session cookies

Switch HTTP authentication in `account.js` from `Authorization: Bearer` JWT to the opaque session cookie backed by Redis. Protected routes (`GET /api/me`, settings, profile) must accept the cookie set by login/register and return 401 when the session is missing, expired, or destroyed.

## Acceptance Criteria

- `requireAuth` reads the session token via `getSessionTokenFromRequest(req)`, loads the session with `getSession(token)`, and sets `req.accountId` (and `req.username` via `findUserByAccountId` lookup when needed).
- Missing cookie, unknown token, or destroyed session → `401` with an error JSON body.
- `GET /api/me` returns 200 with profile when the session cookie from login is sent (use `Cookie` header or `fetch` credentials — no Bearer header).
- `GET /api/me` without a valid session returns 401.
- Malformed `accountId` in a valid session still returns 401 (preserve `SAFE_ACCOUNT_ID_REGEX` guard).
- `account.test.js` updated: `registerAndLogin` helper captures the session cookie instead of parsing `token` from the login body; all authenticated requests use the cookie.
- JWT `verifyToken` remains exported for WebSocket use; do **not** remove JWT code.

## Technical Specs

- **`game/server/account.js`**
  - Replace Bearer + `verifyToken` in `requireAuth` with `getSessionTokenFromRequest` + `getSession` from `../sessions.js` (via `require`).
  - On success: `req.accountId = session.accountId`; resolve `req.username` from `findUserByAccountId`.
  - Remove dependency on `Authorization` header for HTTP routes (Bearer path dropped for `/api/me` et al.).
  - Profile username-change path that currently re-issues `payload.token` via `jwt.sign` may remain for now (socket migration is a later bead) — only `requireAuth` must use cookies.
- **`game/server/test/account.test.js`**
  - Replace `authHeaders(token)` with `cookieHeaders(sessionToken)` built from `Set-Cookie` captured at login.
  - Update `registerAndLogin` to return the session token string (from cookie), not JWT from JSON body.
  - Update or remove tests that mint evil JWTs for HTTP auth — use invalid/expired session tokens instead where traversal tests are needed.

## Verification: code
