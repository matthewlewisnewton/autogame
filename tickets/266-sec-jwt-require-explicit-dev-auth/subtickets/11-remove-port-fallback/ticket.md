# 11-remove-port-fallback

Remove the PORT-based dev-secret fallback from `initAuth()` so that staging/PaaS deploys with `PORT` set but without `ALLOW_DEV_AUTH=1` fail closed instead of signing JWTs with the known `dev-secret`.

## Acceptance Criteria

- The `if (process.env.PORT)` block (currently lines 78–93 in `auth.js`) is removed from `initAuth()`.
- The JSDoc comment for `initAuth()` no longer mentions PORT as a fallback mechanism.
- Dev mode without `ALLOW_DEV_AUTH=1` and without `JWT_SECRET` throws (even when `PORT` is set).
- Non-production environments with `PORT` set (e.g., `NODE_ENV=staging`) and no `JWT_SECRET` throw instead of using `dev-secret`.
- Existing `ALLOW_DEV_AUTH=1` path continues to work unchanged.
- Existing `NODE_ENV=test` path continues to work unchanged.
- Existing `NODE_ENV=production` throw continues to work unchanged.

## Technical Specs

- **File**: `game/server/auth.js`
  - Delete the `if (process.env.PORT)` block (lines ~78–93) that sets `JWT_SECRET = 'dev-secret'` when PORT is present.
  - Update the JSDoc for `initAuth()` to remove references to PORT fallback.
  - The throw at the end of `initAuth()` should remain as the fail-closed default.

## Verification: code
