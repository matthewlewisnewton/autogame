# Cleanup nits from 313-saber-of-light-aoe-per-grind-scaling

> **Staleness note.** This follow-up ticket was written against commit
> `a5f22530` (2026-06-07). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `313-saber-of-light-aoe-per-grind-scaling`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Stabilize Canyon Boss Low-HP Debug Test Event Ordering

The visibility coverage run had one unrelated failure in `server/test/debug-scenarios.test.js`: the live game state had the Canyon Descent miniboss at 1 HP, but the awaited `stateUpdate` assertion observed a prior 300 HP packet. This appears to be test event ordering/stale packet handling rather than a gameplay failure, and it is worth tightening so future coverage logs stay clean.

### Acceptance Criteria
- The `canyon-descent-boss-low-hp` debug scenario test waits for the state update produced by that scenario, not an earlier queued update.
- The full server test suite no longer reports the stale `bossUpdate?.hp` mismatch for this scenario.
