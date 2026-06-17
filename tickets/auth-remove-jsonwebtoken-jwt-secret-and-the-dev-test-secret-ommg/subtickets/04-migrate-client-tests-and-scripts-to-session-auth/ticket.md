# Migrate client tests and smoke scripts to session-cookie auth

Remove dead JWT/token client paths from vitest suites and Playwright/smoke scripts. Browser auth must rely on httpOnly session cookies set by `/api/register` or `/api/login`, not `localStorage('autogame_token')` or Socket.IO `auth.token`.

## Acceptance Criteria

- No `localStorage.setItem('autogame_token', …)` or `localStorage.getItem('autogame_token')` remains under `game/client/test/` or `game/client/scripts/`.
- Playwright/smoke scripts under `game/client/scripts/`, `game/scripts/test-lobby-dropin.mjs`, and `game/docs/walkthroughs/telepipe-tier2/p2-walkthrough-v2.mjs` authenticate by registering/logging in in-browser (or injecting the session cookie via Playwright context) and no longer read `body.token` or pass `auth: { token }` to Socket.IO.
- Client vitest tests that called `createSocket('some-jwt-token')` use `createSocket()` with no token argument (session cookie mocked via existing `/api/me` fetch mock in `game/client/test/setup.js`).
- `rg -i 'autogame_token|body\.token|auth:\s*\{\s*token|jsonwebtoken|JWT_SECRET' game/client game/scripts game/docs/walkthroughs --glob '*.{js,mjs}'` returns no matches (except benign regex in error-message matchers if updated to drop `jwt`).
- `cd game && pnpm test:quick` passes (full quick suite including client vitest).
- Repo-wide `rg -i 'jsonwebtoken|JWT_SECRET|getJWTSecret|verifyToken|dev-secret|test-secret' game/` returns no matches outside historical validation logs under `game/validation/`.

## Technical Specs

- **`game/client/test/*.test.js`** — Remove `localStorage.setItem('autogame_token', …)` setup/teardown; rely on `setup.js` `/api/me` mock + `createSocket()` without token args. Update tests in `main.test.js`, `fly_replay_client.test.js`, and other suites that still pass token strings to `createSocket`.
- **`game/client/scripts/*.mjs`** — Replace shared `register()` helpers that return `body.token` with in-page `fetch('/api/register'|'/api/login', { credentials: 'include' })` followed by reload/navigation so the cookie is present before socket connect. Remove `page.evaluate((t) => localStorage.setItem('autogame_token', t), token)` injection.
- **`game/scripts/test-lobby-dropin.mjs`** — Rewrite `register()` / `connect(token)` to use session cookies on the Socket.IO handshake (`extraHeaders: { cookie: 'ag_session=…' }`) instead of `auth: { token }`.
- **`game/docs/walkthroughs/telepipe-tier2/p2-walkthrough-v2.mjs`** — Same session-cookie login pattern as other capture scripts.
- **`game/client/socketHandlers/connectionHandlers.js`** — Optionally tighten the auth-error regex to session-focused wording (remove `jwt` if no longer emitted).

## Verification: code
