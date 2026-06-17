# Provider-backed `findUserByAccountIdAsync` with cache refresh

Add an async account lookup that reloads the user record from the configured provider when one is set, mirroring how `findUserByUsernameAsync` hydrates on miss but keyed by `accountId`. When a fresh record is loaded, re-hydrate the in-memory `users` Map and indexes so subsequent sync lookups see updated data.

## Acceptance Criteria

- `game/server/users.js` exports `findUserByAccountIdAsync(accountId)`
- With a provider configured: always calls `_usersProvider.loadUserByAccountId(accountId)`, applies `applyUserBackfills`, updates/reindexes the in-memory cache via `hydrateRecord`, and returns the record (or `null`)
- With no provider (file-fallback tests): returns the same result as sync `findUserByAccountId` without throwing
- `game/server/test/users_postgres_provider.test.js` adds a cross-instance read test:
  - Instance A (preloaded): `updateProfile` sets `email` to `survive@example.com`
  - Instance B (preloaded with stale boot snapshot, same shared pool): sync `findUserByAccountId` still shows the old email
  - Instance B: `await findUserByAccountIdAsync(accountId)` returns `email: 'survive@example.com'` and updates B's cache to match
- Existing `users.test.js` and provider tests pass unchanged

## Technical Specs

- **File:** `game/server/users.js`
  - Add `findUserByAccountIdAsync(accountId)` using `_usersProvider.loadUserByAccountId` when provider is set
  - Reuse existing `hydrateRecord` / `applyUserBackfills` / index maintenance helpers
  - Export from `module.exports`
- **File:** `game/server/test/users_postgres_provider.test.js` — add the stale-cache read refresh scenario above (reuse `bootColdInstance`, shared pg-mem pool, `loadUsersAsync` preload pattern)

## Verification: code
