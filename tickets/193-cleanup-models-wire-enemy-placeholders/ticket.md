# Cleanup nits from 162-models-wire-enemy-placeholders

> **Staleness note.** This follow-up ticket was written against commit
> `0513231` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `162-models-wire-enemy-placeholders`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Capture does not visually exercise minion models

The round-2 deterministic smoke capture never summons a minion (`minions: []`
in the probe; the `Vault Wyrm` creature card is in hand but never played), so
the three minion `.glb` models (`ancient_wyrm`, `null_crawler`,
`bulkhead_mauler`) were wired and unit-tested for scale/ground normalization but
not confirmed on-screen. A capture step that plays a creature card would close
the visual loop and guard against future regressions in the minion swap path.

### Acceptance Criteria
- A capture flow plays at least one creature card so a minion spawns during the run.
- The resulting screenshot/probe shows a summoned minion mesh (procedural hidden,
  GLB attached), grounded and sized to its procedural footprint.
