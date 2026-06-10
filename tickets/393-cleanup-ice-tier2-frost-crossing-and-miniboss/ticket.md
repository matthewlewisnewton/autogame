# Cleanup nits from 382-ice-tier2-frost-crossing-and-miniboss

> **Staleness note.** This follow-up ticket was written against commit
> `ff4c5a23` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `382-ice-tier2-frost-crossing-and-miniboss`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Simplify Frost Crossing Tier II Debug Deployment
The `frost-crossing-tier-2` debug scenario currently calls `enterPlayingPhase()` and then immediately clears and rebuilds the run state. This is non-blocking because the final state is correct and normal gameplay is unaffected, but it creates a transient duplicate spawn/run during debug setup.
### Acceptance Criteria
- The `frost-crossing-tier-2` debug scenario deploys directly into the final Tier II run state without creating a transient first run.
- Existing debug-scenario tests for Frost Crossing Tier II still pass.
