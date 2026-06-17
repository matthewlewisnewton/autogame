# Wire users provider at startup and verify cross-instance auth

Call `initUsersWithProvider` and `loadUsersAsync` from server startup after the `StorageProvider` is initialized, mirroring the settings wiring. Add pg-mem integration tests proving register-on-instance-A / login-on-instance-B works through a shared database, and that cosmetic / quest-unlock mutations survive a cold second instance.

## Acceptance Criteria

- `game/server/index.js` `startServer()` calls `initUsersWithProvider(getProvider())` immediately after `initSettingsWithProvider(getProvider())`, then `await loadUsersAsync()` before accepting connections
- Non-test defaults unchanged: `FileProvider` + file-fallback users for single-instance deploys; `InMemoryProvider` in `NODE_ENV=test`; `PostgresProvider` when `PERSISTENCE_BACKEND=postgres` + `DATABASE_URL`
- New pg-mem test (e.g. `game/server/test/users_postgres_provider.test.js`) with two separate `PostgresProvider` instances sharing one pg-mem pool:
  - Instance A: `initUsersWithProvider` + `createUserAsync` registers `cross_inst_user`
  - Instance B: fresh in-memory cache, `initUsersWithProvider` (no `loadUsersAsync` preload of that user), `findUserByUsernameAsync` + `comparePasswordAsync` succeeds for the same credentials
  - Cosmetic mutation via `updateProfile` on A is readable from B via `findUserByAccountId` after `findUserByUsernameAsync` hydrates B's cache
  - `unlockQuestTier` on A is visible on B the same way
- Full server test suite (`pnpm test` from `game/`) passes; no live Postgres required

## Technical Specs

- **File:** `game/server/index.js`
  - Import `initUsersWithProvider`, `loadUsersAsync` from `./users`
  - After the `setTestProvider(...)` / `initSettingsWithProvider` block (~lines 1882–1903), add:
    ```js
    initUsersWithProvider(getProvider());
    await loadUsersAsync();
    ```
  - Ensure test-mode `clearUsers()` still runs before provider init (existing behavior)
- **File:** `game/server/test/users_postgres_provider.test.js` (new)
  - Use pg-mem + `USERS_SCHEMA_SQL` + shared pool
  - Simulate two provider instances and the register/login/mutation scenarios above
  - Assert provider mode does not write to `game/data/users.json` (optional spy on fs or temp path isolation)

## Verification: code
