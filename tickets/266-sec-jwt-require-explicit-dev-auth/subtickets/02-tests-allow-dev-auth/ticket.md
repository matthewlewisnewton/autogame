# 02-tests-allow-dev-auth

Update the `initAuth()` test suite to cover the new `ALLOW_DEV_AUTH` opt-in mechanism and ensure the dev-secret fallback only works with explicit opt-in.

## Acceptance Criteria

- Existing test "uses dev fallback secret when NODE_ENV is not test or production" is updated to set `ALLOW_DEV_AUTH=1` and still passes.
- New test: `initAuth()` throws when `NODE_ENV=development`, `JWT_SECRET` is unset, and `ALLOW_DEV_AUTH` is not set.
- New test: `initAuth()` uses `'dev-secret'` when `ALLOW_DEV_AUTH=1` is explicitly set.
- New test: `initAuth()` ignores `ALLOW_DEV_AUTH` when `JWT_SECRET` is already set (env secret takes priority).
- All existing auth tests continue to pass (the `NODE_ENV=test` path does not require `ALLOW_DEV_AUTH`).

## Technical Specs

- **File**: `game/server/test/auth.test.js` — the `initAuth() dev fallback` describe block (around line 312)
- Update the "uses dev fallback secret" test to also set `process.env.ALLOW_DEV_AUTH = '1'` in its `beforeEach` or inline
- Add test cases for: (a) throw without `ALLOW_DEV_AUTH`, (b) success with `ALLOW_DEV_AUTH=1`, (c) `JWT_SECRET` overrides `ALLOW_DEV_AUTH`
- Add `ALLOW_DEV_AUTH` cleanup in `afterEach` (delete `process.env.ALLOW_DEV_AUTH`)

## Verification: code
