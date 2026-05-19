# Cleanup nits from 044-cleanup-encounter-telegraphs-audio

> **Staleness note.** This follow-up ticket was written against commit
> `d81854c` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `044-cleanup-encounter-telegraphs-audio`.
None blocked acceptance — clean them up when convenient.

## `_playSoundCallLog` grows unbounded in production

`game/client/main.js` declares `_playSoundCallLog` as a "test-only" array,
but `playSound()` unconditionally pushes the sound type into it on every
call — including in the real game, not just under test. Over a long play
session this array grows without bound (a small but real memory leak), and
the test-only intent is misleading since the production path also writes to
it.

### Acceptance Criteria
- `playSound()` does not accumulate an ever-growing log during normal
  gameplay (e.g. gate the push behind a test flag, or cap the array length).
- The `__playSoundCallLog` / `__clearPlaySoundLog` test hooks still work and
  the existing `cardUsed handler — enemyHit sound throttle` tests pass.
