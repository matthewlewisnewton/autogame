# Login and register issue session cookies

Wire session creation into `POST /api/login` and `POST /api/register`: on success, create a Redis session and set the httpOnly session cookie instead of returning a JWT in the response body. Keep existing bcrypt validation, rate limiting, and JWT exports untouched for socket auth.

## Acceptance Criteria

- Successful `POST /api/register` (201) still returns `{ accountId }` and sets the session cookie; response body does **not** include a JWT `token`.
- Successful `POST /api/login` (200) sets the session cookie; response body does **not** include a JWT `token` (may return `{ accountId }` or an empty/minimal body — be consistent and update tests accordingly).
- `Set-Cookie` uses the name from `cookies.js`, is `HttpOnly`, `SameSite=Lax`, `Path=/`, and omits `Secure` outside production.
- A Redis session record exists for the cookie token after login/register (verifiable via `getSession` in tests).
- Existing register/login validation and rate-limit tests in `auth.test.js` still pass; JWT-specific login assertions are updated to cookie-based checks.
- `initAuth()`, `verifyToken()`, and WebSocket JWT paths are unchanged.

## Technical Specs

- **`game/server/auth.js`**
  - Import `createSession` from `./sessions.js` and `setSessionCookie` from `./cookies.js`.
  - After successful `createUserAsync` in `/register`, call `createSession(result.accountId)` and `setSessionCookie(res, token)` before `res.status(201).json(...)`.
  - After successful password check in `/login`, replace `jwt.sign` + `{ token }` response with `createSession` + `setSessionCookie`; remove `token` from JSON body.
  - Leave `verifyToken`, `initAuth`, `getJWTSecret`, and rate-limit exports as-is.
- **`game/server/test/auth.test.js`**
  - Replace “returns JWT token” / `jwt.verify` login tests with assertions on `Set-Cookie` header and absence of `data.token`.
  - Add helper to extract session token from `Set-Cookie` for downstream tests.
  - Register success test: assert cookie present and session exists in Redis via `getSession`.
  - Keep all existing 400/401/409/429 validation tests unchanged except response-shape expectations.

## Verification: code
