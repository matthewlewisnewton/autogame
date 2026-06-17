# Add loadUserByAccountId() to all StorageProviders

Add an async `loadUserByAccountId(accountId)` method to `InMemoryProvider`, `FileProvider`, and `PostgresProvider`. Each provider already stores `accountId` inside the user record JSON; this method queries by that field instead of by username. Existing `loadUser(username)` is unchanged — this is an additional lookup path.

## Acceptance Criteria

- `InMemoryProvider.loadUserByAccountId(accountId)` returns a deep clone of the user record or `null`
- `FileProvider.loadUserByAccountId(accountId)` scans `users.json`, matches on `record.accountId`, returns deep clone or `null`
- `PostgresProvider.loadUserByAccountId(accountId)` queries `SELECT data FROM users WHERE account_id = $1`, returns parsed record or `null`
- All three implementations use `assertSafeStorageKey(accountId, 'accountId')` for input validation
- All three implementations use parameterized queries / Map lookup (no SQL or path injection)
- Existing `loadUser(username)` and `loadAllUsers()` are unchanged
- Existing tests continue to pass (`pnpm test`)

## Technical Specs

- **File:** `game/server/providers.js`
- Add `async loadUserByAccountId(accountId)` to `InMemoryProvider` (~line 118, after `loadUser`) — iterate `this.usersStore.values()`, match `record.accountId`
- Add `async loadUserByAccountId(accountId)` to `FileProvider` (~line 220, after `loadUser`) — scan `readUsersArray()`, match `record.accountId`
- Add `async loadUserByAccountId(accountId)` to `PostgresProvider` (~line 360, after `loadUser`) — query `SELECT data FROM users WHERE account_id = $1` (the `account_id` column already exists per `saveUser` upsert)
- **File:** `game/server/test/providers.test.js` (or a new test file) — add unit tests for each provider's `loadUserByAccountId`

## Verification: code
