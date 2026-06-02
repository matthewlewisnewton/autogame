# Cleanup nits from 162-models-wire-enemy-placeholders

> **Staleness note.** This follow-up ticket was written against commit
> `e89213b` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `162-models-wire-enemy-placeholders`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Visually verify minion placeholder meshes in a capture
The deterministic smoke capture never summoned a minion (`minions: []` in the
probes), so `ancient_wyrm` / `null_crawler` / `bulkhead_mauler` `.glb` models
were only exercised by code review, not by a screenshot. They share the same
`attachRegistryModel`/`normalizeRegistryModel` path as the (verified) enemies,
but a capture that summons a familiar would close the loop.
### Acceptance Criteria
- A capture exists in which at least one minion is summoned and its loaded `.glb`
  is visible, grounded, and roughly primitive-sized.

## Placeholder enemy models read dark under current lighting
In the gameplay screenshots the enemies are dominated by their red hitbox
wireframes; the swapped-in `.glb` silhouettes are hard to make out against the
dark floor. Not a correctness issue (models load and swap correctly), but the
per-entity `ENEMY_MODEL_TUNING` / `MINION_MODEL_TUNING` tables (or a lighting
tweak) could be used to improve readability when real art lands.
### Acceptance Criteria
- Enemy placeholder models are clearly distinguishable from the floor/hitbox in
  a normal gameplay capture (via scale/offset tuning or scene lighting).
