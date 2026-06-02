# Cleanup nits from 136-world-spire-ascent-stage

> **Staleness note.** This follow-up ticket was written against commit
> `8fa54da` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `136-world-spire-ascent-stage`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Capture plan should exercise the spire-ascent stage

The round-1 capture fell back to the `sloped-dungeon` scenario, so the
screenshots never actually show the new spire tiers/ramps. The stage is
covered by unit tests and loads through proven generic rendering, but visual QA
of this specific ticket had no direct screenshot of the spire.

### Acceptance Criteria
- The capture plan for spire-ascent loads `?debugScenario=spire-ascent` (or
  `spire-ascent-stage`) and captures at least one screenshot showing stacked
  tiers and a connecting ramp.

## Deduplicate spire-ascent debug-scenario layout setup

`applyDebugScenario`'s `spire-ascent-stage` branch in `game/server/index.js`
hand-rolls layout regeneration (generateLayout + bounds + AABBs +
rebuildWallColliders + start-room seating) that largely duplicates
`applyLayoutForQuest`. Consolidating reduces the chance the debug path drifts
from normal play.

### Acceptance Criteria
- The `spire-ascent-stage` debug branch reuses the shared layout-application
  helper(s) rather than re-deriving bounds/colliders inline, with no behavior
  change.

## Enemy can spawn on the player's start tier

`pickSpireAscentEnemySpawn` assigns `spawnIndex 0` to the bottom (`start`) tier,
which is consistent with "each tier has its own enemies" but can place a hostile
near the player's spawn point. Consider biasing the bottom-tier spawn away from
the start-room centre.

### Acceptance Criteria
- Bottom-tier enemy spawns keep a minimum clearance from the player spawn point
  so players are not immediately adjacent to an enemy on deploy.
