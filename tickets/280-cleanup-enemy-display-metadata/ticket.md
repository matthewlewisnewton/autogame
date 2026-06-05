# Cleanup nits from 251-enemy-display-metadata

> **Staleness note.** This follow-up ticket was written against commit
> `58aa4f32` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `251-enemy-display-metadata`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## ENEMY_DEFS display test should iterate registry keys dynamically

The variant display-metadata test uses `Object.keys(VARIANT_DEFS)` so new variants are automatically covered, but the enemy-type test hardcodes `['grunt', 'skirmisher', 'miniboss', 'spawner']`. If a fifth enemy type is added to `ENEMY_DEFS` without updating the test array, display metadata could be missing while tests still pass.

### Acceptance Criteria
- Change the `ENEMY_DEFS` display-metadata test to iterate `Object.keys(ENEMY_DEFS)` (or derive the type list from the registry) instead of a hardcoded array.
- Adding a new type to `ENEMY_DEFS` without display metadata causes the vitest suite to fail.

## ensureEnemyCombatStats display-field exclusion lacks direct test

`spawnEnemy` is tested to confirm display metadata is not copied onto enemies, but `ensureEnemyCombatStats` (the backfill path for test/corrupt enemies) applies the same destructuring exclusion without a dedicated assertion. A regression that only affects the backfill path would not be caught.

### Acceptance Criteria
- Add a unit test that creates a minimal enemy object missing combat stats, calls `ensureEnemyCombatStats`, and asserts combat fields are backfilled while `name`, `description`, and `surfacedStats` remain absent.
