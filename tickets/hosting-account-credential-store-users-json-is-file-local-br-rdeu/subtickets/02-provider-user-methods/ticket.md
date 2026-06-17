# StorageProvider user methods and provider implementations

Extend the `StorageProvider` interface with async user-store methods and implement them in `InMemoryProvider`, `FileProvider`, and `PostgresProvider`. PostgresProvider must call `ensureUsersSchema` during `PostgresProvider.create` (unless `skipSchemaEnsure`).

## Acceptance Criteria

- `StorageProvider` exports four new abstract methods — `loadAllUsers()`, `loadUser(username)`, `saveUser(record)`, `deleteUser(username)` — each throwing `"Not implemented"` on the base class
- **InMemoryProvider:** keeps a separate in-process `usersStore` Map keyed by `username`; `loadAllUsers` returns all values; `loadUser`/`saveUser`/`deleteUser` operate on that Map with deep copies on read/write
- **FileProvider:** persists users to `{basePath}/users.json` as a JSON array (same on-disk shape as today's `users.js`); `saveUser` upserts one record and rewrites the file atomically (unique tmp + rename); `loadAllUsers` reads/parses the array (returns `[]` when missing); `deleteUser` removes a username then rewrites
- **PostgresProvider:** `saveUser` upserts into `users` (`username`, `account_id`, `data` jsonb) with `ON CONFLICT (username) DO UPDATE`; `loadUser` selects by `username`; `loadAllUsers` selects all rows; `deleteUser` deletes by `username`; returns `null` / `[]` when absent
- Usernames and accountIds are validated before I/O (reuse or mirror `assertSafePlayerId` / a dedicated safe-key guard so path traversal ids are rejected)
- `PostgresProvider.create` awaits `ensureUsersSchema` after players/settings schema ensure
- pg-mem tests in `game/server/test/postgres_provider.test.js` cover user round-trip, unknown username, overwrite, isolation between users, UUID-shaped accountIds, and traversal rejection — using `USERS_SCHEMA_SQL` in `createProvider()`

## Technical Specs

- **File:** `game/server/storage.js` — add the four abstract user methods
- **File:** `game/server/providers.js`
  - Implement user methods on all three concrete providers
  - Import and call `ensureUsersSchema` from `ensurePlayersSchema.js` inside `PostgresProvider.create`
  - `saveUser` stores the full record object in `data` jsonb (including `username`, `accountId`, `passwordHash`, cosmetics, quest maps, optional `email`)
- **File:** `game/server/test/postgres_provider.test.js`
  - Extend `createProvider()` to apply `USERS_SCHEMA_SQL`
  - Add user-store test cases with a sample record matching `createUser` output shape

## Verification: code
