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
