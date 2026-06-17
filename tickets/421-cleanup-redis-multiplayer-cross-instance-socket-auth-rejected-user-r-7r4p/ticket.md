# Cleanup nits from redis-multiplayer-cross-instance-socket-auth-rejected-user-r-7r4p

> **Staleness note.** This follow-up ticket was written against commit
> `d319c614` (2026-06-17). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `redis-multiplayer-cross-instance-socket-auth-rejected-user-r-7r4p`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

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
