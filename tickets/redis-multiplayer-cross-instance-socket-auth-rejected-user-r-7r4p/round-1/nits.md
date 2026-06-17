## buildPlayerRecord still uses sync findUserByAccountId

`game/server/index.js:1148` (`buildPlayerRecord`) calls the synchronous
`findUserByAccountId(accountId)`. It works today only because the `io.use()`
auth middleware always runs `findUserByAccountIdAsync` first and warms the
cache, so by the time the connection handler builds the player record the
accountId is guaranteed to be in `accountIdIndex`. This is an implicit ordering
dependency: if any future code path reaches `buildPlayerRecord` for an account
that was not pre-hydrated by the middleware, it would silently get a `null`
account on a cold instance. Switching it to `await findUserByAccountIdAsync`
(or asserting the invariant) would remove the hidden coupling.

### Acceptance Criteria
- `buildPlayerRecord` resolves the account record via the lazy-loading path
  (or there is an explicit invariant/comment documenting that the middleware
  guarantees a warm cache), so it cannot return a stale `null` account on a
  cold cross-instance server.
- Existing tests continue to pass.
