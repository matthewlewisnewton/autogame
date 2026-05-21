# Provide Dev JWT Secret Fallback

Allow the server to start in the standard dev/harness environment without requiring `JWT_SECRET` in the environment. The server currently throws on missing secret, which prevents `pnpm run dev` from launching.

## Acceptance Criteria
- Running `pnpm run dev` (from `game/`) starts both the Express backend and Vite frontend without crashing.
- `game/server/auth.js` uses a dev-only fallback secret (e.g. `'dev-secret'`) when `JWT_SECRET` is not set and `NODE_ENV` is not `'production'`.
- The `initAuth()` function still throws when `JWT_SECRET` is missing **and** `NODE_ENV === 'production'`.
- Tests continue to pass (they run with `NODE_ENV === 'test'`, which already has its own fallback).
- The server logs a warning when using the dev fallback secret.

## Technical Specs
- **Modify**: `game/server/auth.js` — in `initAuth()`, add a fallback branch between the `NODE_ENV === 'test'` check and the throw: when `JWT_SECRET` is not set and `NODE_ENV !== 'production'`, set `JWT_SECRET = 'dev-secret'` and log a console warning. Only throw when `NODE_ENV === 'production'` and no secret is set.
- **Modify**: `game/server/test/auth.test.js` — verify (or add) a test that confirms `initAuth()` succeeds without `JWT_SECRET` when `NODE_ENV` is neither `'test'` nor `'production'` (dev fallback path).

## Verification: code
