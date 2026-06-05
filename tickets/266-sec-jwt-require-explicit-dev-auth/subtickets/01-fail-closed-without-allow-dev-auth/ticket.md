# 01-fail-closed-without-allow-dev-auth

Require explicit opt-in (`ALLOW_DEV_AUTH=1`) for the dev-secret fallback in `initAuth()`. When `JWT_SECRET` is unset and `NODE_ENV` is neither `test` nor `production`, throw an error unless `ALLOW_DEV_AUTH=1` is set.

## Acceptance Criteria

- `initAuth()` throws when `JWT_SECRET` is unset, `NODE_ENV` is not `test` or `production`, and `ALLOW_DEV_AUTH` is not `'1'`.
- `initAuth()` still uses the `'dev-secret'` fallback when `ALLOW_DEV_AUTH=1` is set (and `JWT_SECRET` is unset, `NODE_ENV` is not `test` or `production`).
- `initAuth()` behavior is unchanged when `JWT_SECRET` is explicitly set (uses the env value regardless of `ALLOW_DEV_AUTH`).
- `initAuth()` behavior is unchanged in `NODE_ENV=test` (uses `'test-secret'` fallback without requiring `ALLOW_DEV_AUTH`).
- `initAuth()` throws in `NODE_ENV=production` when `JWT_SECRET` is unset (unchanged).

## Technical Specs

- **File**: `game/server/auth.js` — modify `initAuth()` (around line 65)
- Insert a check before the dev fallback: require `process.env.ALLOW_DEV_AUTH === '1'` to permit the `'dev-secret'` fallback
- If `ALLOW_DEV_AUTH` is not set, throw an error similar to the production case, explaining that `JWT_SECRET` must be set or `ALLOW_DEV_AUTH=1` must be explicitly enabled
- Update the `initAuth()` JSDoc to document the new `ALLOW_DEV_AUTH` requirement

## Verification: code
