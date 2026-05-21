# Enforce JWT Secret at Startup

Require `JWT_SECRET` environment variable for production server runs. Fail startup with a clear error message when the secret is missing, instead of silently falling back to a hard-coded `'dev-secret'` that anyone can forge.

## Acceptance Criteria
- `game/server/auth.js` reads `JWT_SECRET` from `process.env.JWT_SECRET`.
- When `JWT_SECRET` is **not set** and `NODE_ENV` is not `'test'`, the server **refuses to start** — `auth.js` exports an `initAuth()` (or equivalent) that throws a descriptive error when called without a valid secret.
- When `NODE_ENV` is `'test'`, a default test secret (e.g. `'test-secret'`) is used so tests run without env setup.
- `game/server/index.js` calls the auth initialization before starting the HTTP/Socket.IO server, so a missing secret prevents the server from listening.
- Unit tests for `auth.js` continue to pass (they run with `NODE_ENV='test'` or a mocked secret).

## Technical Specs
- **Modify**: `game/server/auth.js` — remove the `|| 'dev-secret'` fallback. Export an `initAuth()` function that checks `process.env.JWT_SECRET`, throws if missing (unless `NODE_ENV === 'test'`), and returns the resolved secret. Keep the secret in a module-level variable after init.
- **Modify**: `game/server/index.js` — add `const { initAuth } = require('./auth');` and call `initAuth()` at the top of `startServer()` (or before it) so the server crashes fast with a clear message if the secret is absent.
- **Modify**: `game/server/test/auth.test.js` — ensure tests set `NODE_ENV = 'test'` or mock `process.env.JWT_SECRET` before importing `auth.js`.
- **Modify**: `game/server/test/websocket_jwt_auth.test.js` — same test-env guard.

## Verification: code
