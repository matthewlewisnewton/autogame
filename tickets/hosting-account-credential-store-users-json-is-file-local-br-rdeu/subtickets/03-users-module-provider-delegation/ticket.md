# Route users.js through the storage provider (async, no deasync)

Refactor `users.js` so credential load/save goes through the `StorageProvider` user methods when a provider is configured, using `await` throughout (no `deasync`). Keep the existing file-based `users.json` path as the fallback for tests that call `setTestFilePath` without a provider. Remove the synchronous `loadUsers()` call at module bottom; hydration happens via an explicit async bootstrap.

## Acceptance Criteria

- `users.js` adds `_usersProvider` (initially `null`) and exports `initUsersWithProvider(provider)` to enable provider mode
- `loadUsersAsync()` hydrates the in-memory Map + `accountIdIndex` / `emailIndex` from `_usersProvider.loadAllUsers()` when a provider is set; applies the same backfill helpers used today (`backfillCosmetic`, `backfillUnlockedHats`, quest-tier backfills)
- Internal `persistUserAsync(record)` awaits `_usersProvider.saveUser(record)` in provider mode; in file-fallback mode it calls the existing synchronous bulk `saveUsers()` (unchanged atomic `users.json` write)
- `createUserAsync` awaits `persistUserAsync` after mutating the in-memory Map
- `findUserByUsernameAsync(username)` returns the in-memory hit when present; on miss with a provider configured, loads via `_usersProvider.loadUser(username)`, backfills, indexes into memory, and returns the record (enables login on a second instance whose cache was empty at boot)
- `setTestFilePath`, `clearUsers`, `getUsersFilePath`, and synchronous `loadUsers`/`saveUsers` continue to work for file-fallback tests without a provider
- No `deasync` import or usage anywhere in `users.js`
- Existing `game/server/test/users.test.js` and other users tests that use `setTestFilePath` pass without modification

## Technical Specs

- **File:** `game/server/users.js`
  - Add `_usersProvider`, `initUsersWithProvider`, `loadUsersAsync`, `persistUserAsync`, `findUserByUsernameAsync`
  - Remove top-level `loadUsers()` auto-run at module init (line ~195); callers bootstrap explicitly
  - Wire `createUserAsync` to `await persistUserAsync(record)` instead of sync `saveUsers()`
  - `deleteUser` provider calls when username changes in `updateProfile` (delete old username key, save new record) — may be deferred to sub-ticket 04 if `updateProfile` is still sync here; at minimum `createUserAsync` + `findUserByUsernameAsync` must be provider-aware
  - Export new functions from `module.exports`
- **File:** `game/server/auth.js`
  - `POST /api/login` uses `await findUserByUsernameAsync(username)` instead of sync `findUserByUsername` so cross-instance login can read Postgres

## Verification: code
