# Cleanup nits from 295-fire-level

> **Staleness note.** This follow-up ticket was written against commit
> `147035a8` (2026-06-06). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `295-fire-level`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Remove Duplicated Arena Trials Debug Branches

`game/server/index.js` lists the `arena-trials-*` debug scenario names twice, and `game/server/debugScenarios.js` contains duplicate `arena-trials-near-adds`, `arena-trials-boss-approach`, and `arena-trials-boss-low-hp` branches where the later branches are unreachable. This is non-blocking for the fire level, but cleaning it up will make future debug scenario maintenance less error-prone.

### Acceptance Criteria
- Each `arena-trials-*` debug scenario is registered once and implemented by one canonical branch.
- Existing arena-trials debug scenario tests still pass.
