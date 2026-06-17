# Cross-instance socket auth tests

Add tests to verify the full cross-instance authentication fix: a user registered on instance A can authenticate via socket.io on instance B through lazy-load from shared Postgres. Tests cover both the storage-layer `loadUserByAccountId` and the end-to-end socket middleware path.

## Acceptance Criteria

- `users_postgres_provider.test.js` has a test: after `bootColdInstance(providerB)` (no preload), `findUserByAccountIdAsync(accountId)` for a user created on instance A returns the user record with correct username
- `users_postgres_provider.test.js` has a test: `findUserByAccountIdAsync` hydrates the record into `accountIdIndex` so a subsequent sync `findUserByAccountId(accountId)` also returns the record (not `null`)
- `websocket_session_auth.test.js` has a test: two servers share a pg-mem Postgres pool; user registers on A, gets session cookie, connects socket.io to B with that cookie — receives `init` event (not `connect_error`)
- All tests pass (`pnpm test`)

## Technical Specs

- **File:** `game/server/test/users_postgres_provider.test.js`
  - Import `findUserByAccountIdAsync` from `../users.js`
  - Add test "findUserByAccountIdAsync lazy-loads user created on A from cold instance B" — create user on A, `bootColdInstance(providerB)` with `preload: false`, assert `findUserByAccountIdAsync(created.accountId)` returns non-null with correct username
  - Add test "findUserByAccountIdAsync hydrates into accountIdIndex for subsequent sync lookup" — after async lookup, assert `findUserByAccountId(accountId)` also returns record
- **File:** `game/server/test/websocket_session_auth.test.js`
  - Add test "cross-instance socket auth: user registered on A connects to B via lazy-load" — use `newDb` (pg-mem) for shared pool, create `PostgresProvider` instances for both servers, register user on A, create session, connect socket.io client to B URL with A-issued cookie, assert `init` fires (not `connect_error`)

## Verification: code
