# JWT cross-instance verification tests

Add automated tests proving JWT authentication is stateless and secret-driven: a token minted with a shared `JWT_SECRET` must verify after a simulated second server boot (secret re-init), and must fail when instances use different secrets. Confirm production still fails fast when `JWT_SECRET` is missing.

## Acceptance Criteria

- A new or extended vitest suite demonstrates that `jwt.sign` + `verifyToken` succeeds when `resetAuthSecret()` then `initAuth()` is called again with the **same** `JWT_SECRET` (simulating a WebSocket landing on a different instance).
- The same suite demonstrates `verifyToken` returns `null` after re-init with a **different** `JWT_SECRET` (wrong instance secret rejects the token).
- Existing `initAuth()` production guard test remains passing: `NODE_ENV=production` without `JWT_SECRET` throws `Missing JWT_SECRET`.
- No change to runtime auth behavior for single-instance dev/test flows (`pnpm test:quick` auth-related tests still pass).

## Technical Specs

- **`game/server/test/multi_instance_jwt.test.js`** (preferred new file) or extend **`game/server/test/auth.test.js`**:
  - Import `initAuth`, `resetAuthSecret`, `verifyToken`, `getJWTSecret` from `../auth.js` and `jwt` from `jsonwebtoken`.
  - In `beforeEach`/`afterEach`, save and restore `NODE_ENV`, `JWT_SECRET`, and call `resetAuthSecret()`.
  - Test "shared secret across simulated instances": set `process.env.JWT_SECRET = 'shared-hosting-secret'`, `initAuth()`, sign a payload `{ accountId: 'acct-multi', username: 'player' }`, `resetAuthSecret()`, `initAuth()` again with the same env, assert `verifyToken(token)` decodes matching claims.
  - Test "mismatched secret rejects": same flow but second `initAuth()` uses a different `JWT_SECRET`; assert `verifyToken(token)` is `null`.
  - Optionally assert `getJWTSecret()` returns the env value and that no in-memory session map is consulted (verifyToken only uses module `JWT_SECRET`).
- Do **not** change `game/server/auth.js` logic unless a minimal export is required for testing (prefer testing through public exports only).

## Verification: code
