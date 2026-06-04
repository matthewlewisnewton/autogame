# Cleanup nits from 223-data-derive-shop-pool-from-defs

> **Staleness note.** This follow-up ticket was written against commit
> `c3bc9e1` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `223-data-derive-shop-pool-from-defs`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Remove Hardcoded Card Count From Acquisition Test

`game/server/test/card_acquisition.test.js` currently asserts that both card definition maps have exactly 42 keys. The key-parity assertion already catches sync drift, so the fixed count will create unnecessary test churn when a future ticket intentionally adds or removes a card.

### Acceptance Criteria
- The acquisition coverage test verifies server/shared card definition parity without hardcoding the current total card count.
