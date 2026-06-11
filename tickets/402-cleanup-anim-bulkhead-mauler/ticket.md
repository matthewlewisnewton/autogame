# Cleanup nits from 325-anim-bulkhead-mauler

> **Staleness note.** This follow-up ticket was written against commit
> `f775de9d` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `325-anim-bulkhead-mauler`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Consolidate Bulkhead Mauler per-hit spark sources

On the shockwave attack, hit-enemy sparks come from two places for the same
hits: `renderBulkheadMaulerShockwaveSweep` loops `data.hits` calling
`spawnHitSpark`, and the shared `applyHitFlashes` post-effect also flashes (and
the default path can spark) the same enemies. The result is slightly doubled
spark VFX on each struck enemy. Pick one source so the impact reads cleanly.

### Acceptance Criteria
- Each enemy struck by a Bulkhead Mauler shockwave shows a single, intentional
  hit spark/flash (no visible doubling).
- Behavior is covered or asserted in `game/client/test/cardRenderers.test.js`.
