# Add findUserByAccountIdAsync() with lazy-load from storage

Add `findUserByAccountIdAsync(accountId)` to `users.js`, following the exact same pattern as the existing `findUserByUsernameAsync`: check in-memory `accountIdIndex` first, on miss call `_usersProvider.loadUserByAccountId(accountId)`, hydrate the record into both indexes, and return it. The existing sync `findUserByAccountId()` stays unchanged for callers that are not async.

## Acceptance Criteria

- `findUserByAccountIdAsync(accountId)` returns cached record when `accountIdIndex` already has the accountId
- `findUserByAccountIdAsync(accountId)` returns `null` when accountId is absent from cache AND no provider is configured
- `findUserByAccountIdAsync(accountId)` on cache miss calls `_usersProvider.loadUserByAccountId(accountId)`, hydrates the record (into `users` Map and `accountIdIndex`), and returns it
- `findUserByAccountIdAsync(accountId)` returns `null` when provider's `loadUserByAccountId` returns `null`
- The existing sync `findUserByAccountId()` is NOT modified
- `findUserByAccountIdAsync` is exported from `users.js`
- All existing tests continue to pass (`pnpm test`)

## Technical Specs

- **File:** `game/server/users.js`
  - Add `async function findUserByAccountIdAsync(accountId)` after the sync `findUserByAccountId` (~line 368). Pattern:
    ```js
    const cached = accountIdIndex.get(accountId);
    if (cached) return cached;
    if (!_usersProvider || typeof _usersProvider.loadUserByAccountId !== 'function') return null;
    const record = await _usersProvider.loadUserByAccountId(accountId);
    if (!record) return null;
    return hydrateRecord(record);
    ```
  - Add `findUserByAccountIdAsync` to the `module.exports` block (~line 718)
- **File:** `game/server/test/users.test.js`
  - Add tests for `findUserByAccountIdAsync`: cache hit, cache miss with provider, no provider, nonexistent accountId

## Verification: code
