# Add O(1) accountId and email indexes in users.js

`findUserByAccountId` and `findUserByEmail` in `game/server/users.js` scan the entire in-memory `users` Map on hot socket/HTTP paths (`lobbyHandlers`, `index.js`, `account.js`). Maintain secondary indexes so both lookups are O(1) while preserving current return values and duplicate-email checks.

## Acceptance Criteria

- Module-level `accountIdIndex` (`Map<accountId, userRecord>`) and `emailIndex` (`Map<normalizedEmail, userRecord>`) exist alongside the primary `users` Map
- `findUserByAccountId` and `findUserByEmail` read from the indexes (no full `users.values()` scan)
- Indexes are populated on `loadUsers()` and updated on `createUser`, `createUserAsync`, `updateProfile` (username key change does not affect indexes; email change removes old email key and adds new), and cleared/rebuilt in `clearUsers()` / `setTestFilePath` reload paths
- Duplicate-email validation in `updateProfile` still rejects emails held by a different `accountId`
- Existing `game/server/test/users.test.js` and dependent persistence tests pass unchanged in behavior

## Technical Specs

- **File:** `game/server/users.js`
  - Add `accountIdIndex` and `emailIndex` module-level Maps
  - Add `indexUser(record)` / `unindexUser(record)` helpers that set/delete `accountId` and normalized `email` entries
  - Call `indexUser` for each record in `loadUsers()` after backfill
  - Call `indexUser` after `users.set` in `createUser` / `createUserAsync`
  - In `updateProfile`, when `fields.email` changes, `unindexUser` old email (if any) before assigning `user.email`, then `indexUser` after mutation; handle `email: null` clearing
  - Update `clearUsers()` to clear both indexes
  - Update `setTestFilePath` reload path to rebuild indexes after `loadUsers()`
  - Rewrite `findUserByAccountId` / `findUserByEmail` to use indexes
- **Tests:** Extend `game/server/test/users.test.js` if helpful to assert index consistency after profile email updates (optional small unit test)

## Verification: code
