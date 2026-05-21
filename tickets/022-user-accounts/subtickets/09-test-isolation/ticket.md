# Isolate Auth and User Tests from Durable Records

Auth/user tests share the global in-memory user Map and a fixed user file path, causing cross-test pollution. Under `pnpm run test -- --coverage`, registration tests receive `409` for first-time fixed usernames and JWT/accountId assertions fail because persisted user records from earlier tests are loaded on startup. Give each test file an isolated temp file path and restore the user-store state before and after every test.

## Acceptance Criteria
- `game/server/test/auth.test.js` — each test uses a unique temp user file path (via `setTestFilePath`) and clears the user map before each test.
- `game/server/test/users.test.js` — the `file-backed persistence` describe block already uses temp files; verify the non-file tests also use isolated state.
- `game/server/users.js` — `setTestFilePath` must also re-initialize `loadUsers()` or provide a way to clear the file state between tests so that a new temp path starts empty.
- Running `pnpm run test -- --coverage` (from `game/`) completes with all auth and user tests passing deterministically — no `409` on first registration, no stale accountId in JWT.
- The `beforeEach` in `auth.test.js` calls `clearUsers()` AND `setTestFilePath(tempFile)` with a fresh temp path per test run.

## Technical Specs
- **Modify**: `game/server/test/auth.test.js` —
  - Import `setTestFilePath` and `loadUsers` from `../users.js`.
  - In `beforeEach`, create a unique temp file path (e.g., `path.join(os.tmpdir(), `auth-test-${Date.now()}.json`)`), call `setTestFilePath(tmpFile)`, then `clearUsers()`.
  - In `afterEach`, clean up the temp file if it exists.
  - This ensures each test run starts with an empty user store and doesn't pollute the shared `data/users.json`.
- **Modify**: `game/server/test/users.test.js` —
  - The `createUser` and `findUserByUsername` describes (non-file-backed) should also use `setTestFilePath` with a temp path to avoid polluting the real user file.
  - Add `setTestFilePath(tmpFile)` and `clearUsers()` to the `beforeEach` of the `createUser` and `findUserByUsername` describe blocks.
- **Modify**: `game/server/users.js` — ensure `setTestFilePath` clears any cached state (currently it only updates the module-level `usersFilePath` variable, which is sufficient, but verify that `loadUsers()` is not called again after `setTestFilePath`).

## Verification: code
