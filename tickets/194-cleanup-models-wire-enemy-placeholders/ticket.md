# Cleanup nits from 162-models-wire-enemy-placeholders

> **Staleness note.** This follow-up ticket was written against commit
> `fae7ff4` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `162-models-wire-enemy-placeholders`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Minion model rendering not exercised by capture

The deterministic fallback smoke capture never summons a minion (`minions: []` in
both probes), so the three minion GLBs (`ancient_wyrm`, `null_crawler`,
`bulkhead_mauler`) are only verified by unit tests, not by a screenshot. A capture
plan that casts a Signal Familiar (or similar minion-spawning card) would let QA
visually confirm minion meshes load and ground correctly the same way enemies do.

### Acceptance Criteria
- A capture scenario spawns at least one minion during gameplay.
- The resulting probe shows a non-empty `minions[]` and a screenshot shows the
  minion mesh sitting on the floor.

## Minion groundOffset hardcoded rather than derived

`MODEL_FIT` derives enemy `groundOffset` from `enemyMeshHalfHeight`, but minion
`groundOffset` is a hardcoded `0.5` (`renderer.js:296`) that mirrors the render-loop
literal at `renderer.js:3366`. If the minion host lift ever changes, the two
literals can drift apart silently. Consider sourcing both from one shared constant.

### Acceptance Criteria
- The minion host Y lift and `MODEL_FIT` minion `groundOffset` reference a single
  shared constant so they cannot diverge.
