# Wire socket auth middleware to findUserByAccountIdAsync()

Replace the synchronous `findUserByAccountId()` call in the `io.use()` middleware with the new async `findUserByAccountIdAsync()`. The middleware is already an `async` callback, so the switch is a single-line change plus updating the import. This is the core fix — when instance B receives a session cookie for a user created on instance A, the async lookup falls back to Postgres to hydrate the account into B's in-memory index.

## Acceptance Criteria

- `io.use()` middleware in `server/index.js` calls `await findUserByAccountIdAsync(session.accountId)` instead of `findUserByAccountId(session.accountId)`
- The import at the top of `server/index.js` includes `findUserByAccountIdAsync` from `./users`
- The error message `'Session account not found'` is preserved when async lookup returns `null`
- `socket.data.accountId` and `socket.data.username` are still set from the returned user
- All existing tests continue to pass (`pnpm test`)

## Technical Specs

- **File:** `game/server/index.js`
  - Line ~22: update import to add `findUserByAccountIdAsync`:
    `const { findUserByAccountId, findUserByAccountIdAsync, unlockHat: unlockHatForAccount, isQuestTierUnlocked } = require('./users');`
  - Line ~1960: change `const user = findUserByAccountId(session.accountId);` to `const user = await findUserByAccountIdAsync(session.accountId);`
- No other files need changes

## Verification: code
