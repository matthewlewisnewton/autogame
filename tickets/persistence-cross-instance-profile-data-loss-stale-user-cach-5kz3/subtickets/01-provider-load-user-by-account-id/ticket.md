# Add `loadUserByAccountId` to storage providers

Extend the `StorageProvider` user API with account-id lookup so `users.js` can reload a single record from Postgres (or other backends) without scanning the in-memory cache or loading by username. This is the foundation for provider-backed profile reads and read-modify-write updates.

## Acceptance Criteria

- `StorageProvider` in `game/server/storage.js` declares `async loadUserByAccountId(accountId)` (default throws `Not implemented`)
- `PostgresProvider.loadUserByAccountId` queries `SELECT data FROM users WHERE account_id = $1`, validates the key with `assertSafeStorageKey`, and returns a deep-cloned record or `null`
- `InMemoryProvider` and `FileProvider` implement the same method for test/file parity (lookup by `record.accountId` in the users store or `users.json` array)
- `game/server/test/postgres_provider.test.js` includes a test: save a user, load by `accountId`, assert deep equality; unknown id returns `null`
- Existing provider tests continue to pass

## Technical Specs

- **File:** `game/server/storage.js` — add `loadUserByAccountId(accountId)` to the abstract class
- **File:** `game/server/providers.js`
  - `InMemoryProvider`: scan `usersStore` values (or maintain no extra index — small test store)
  - `FileProvider`: read `users.json` array and find matching `accountId`
  - `PostgresProvider`: parameterized query on `users.account_id`
- **File:** `game/server/test/postgres_provider.test.js` — add `loadUserByAccountId` coverage alongside existing `loadUser` tests

## Verification: code
