# 12-fix-port-fallback-tests

Update the `initAuth() dev fallback` test suite to expect throw when only `PORT` is set (without `ALLOW_DEV_AUTH=1`), removing tests that codify the insecure PORT bypass.

## Acceptance Criteria

- Test `"throws in dev mode without ALLOW_DEV_AUTH or PORT"` is updated to assert throw when only `PORT` is set (rename to reflect new behavior, e.g., `"throws in dev mode with PORT but without ALLOW_DEV_AUTH"`).
- Test `"uses dev fallback secret when PORT is set (harness signal)"` is removed or replaced with a test asserting throw when only `PORT` is set.
- Test `"PORT fallback does NOT fire in production"` is removed (redundant — production already throws regardless).
- Test `"JWT_SECRET env value takes precedence over PORT fallback"` is removed (the PORT fallback no longer exists).
- Remaining tests still pass: `ALLOW_DEV_AUTH=1` success, production throw, test-secret in `NODE_ENV=test`, JWT_SECRET precedence over ALLOW_DEV_AUTH.
- Full vitest suite passes (`pnpm test` from `game/`).

## Technical Specs

- **File**: `game/server/test/auth.test.js`
  - In the `initAuth() dev fallback` describe block:
    - Remove or rewrite the PORT-specific tests to expect throw instead of `dev-secret`.
    - Keep the env save/restore in `beforeEach`/`afterEach` (PORT cleanup is still needed since harness may set it).
  - Verify all 32 auth tests pass with `pnpm test`.

## Verification: code
