# Cleanup nits from persistence-cross-instance-profile-data-loss-stale-user-cach-5kz3

> **Staleness note.** This follow-up ticket was written against commit
> `33a7645a` (2026-06-17). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `persistence-cross-instance-profile-data-loss-stale-user-cach-5kz3`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Harden unlockHat / unlockQuestTier against the same cross-instance clobber

`updateProfile` and all profile reads were converted to reload authoritative
state via `findUserByAccountIdAsync` before mutating + persisting. But
`unlockHat` (game/server/users.js:494) and `unlockQuestTier` still read the
sync in-memory cache (`findUserByAccountId`) and then `persistUserAsync` the
whole record. On a stale cross-instance cache this retains the same whole-blob
clobber shape the ticket fixed for profile fields (e.g. an unrelated email/
cosmetic field changed on instance A could be overwritten by instance B's hat
unlock). It is outside this ticket's profile-store scope and not exercised by
the repro, but it is the same root cause and worth closing.

### Acceptance Criteria
- `unlockHat` reloads the authoritative record (via `findUserByAccountIdAsync`
  or equivalent provider read) before appending and persisting.
- `unlockQuestTier` does the same before mutating `unlockedQuestTiers`.
- A regression test (mirroring `updateProfile on stale instance B does not
  clobber ...`) proves a hat/quest unlock on stale instance B does not clobber
  an unrelated field written on instance A.
