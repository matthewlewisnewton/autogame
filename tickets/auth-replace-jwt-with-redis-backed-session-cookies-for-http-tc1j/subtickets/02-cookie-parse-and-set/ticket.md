# Minimal HTTP session cookie helpers

Add a small cookie utility module for parsing `Cookie` headers and emitting `Set-Cookie` for the opaque session token. This module is shared by auth routes and `requireAuth` middleware.

## Acceptance Criteria

- `parseCookies(cookieHeader)` returns a plain object of name → value; handles missing/empty header, multiple cookies, and URL-decoded values.
- `getSessionTokenFromRequest(req)` reads the configured session cookie name from `req.headers.cookie`.
- `setSessionCookie(res, token)` appends a `Set-Cookie` with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` **only** when `NODE_ENV === 'production'` (local `http://` dev must work without Secure).
- `clearSessionCookie(res)` clears the session cookie (Max-Age=0 or equivalent) with the same attribute flags.
- Unit tests cover parse edge cases and that production vs non-production cookie strings include or omit `Secure`.

## Technical Specs

- **`game/server/cookies.js`** (new)
  - Export `SESSION_COOKIE_NAME` (e.g. `ag_session`), `parseCookies`, `getSessionTokenFromRequest`, `setSessionCookie`, `clearSessionCookie`.
  - No `cookie-parser` dependency — manual split on `;` is sufficient.
  - `setSessionCookie` / `clearSessionCookie` use `res.append('Set-Cookie', ...)` so multiple cookies remain possible.
- **`game/server/test/cookies.test.js`** (new)
  - Test parsing single and multiple cookies, empty header, and `getSessionTokenFromRequest` with a mock `req`.
  - Snapshot or string-match the built `Set-Cookie` for `NODE_ENV=test` vs `NODE_ENV=production` (save/restore env in `afterEach`).

## Verification: code
