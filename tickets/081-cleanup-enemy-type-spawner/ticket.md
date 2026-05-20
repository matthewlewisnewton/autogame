# Cleanup nits from 078-enemy-type-spawner

> **Staleness note.** This follow-up ticket was written against commit
> `f545ec6` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `078-enemy-type-spawner`.
None blocked acceptance — clean them up when convenient.

## `spawner-active` debug scenario duplicates spawner construction
`applyDebugScenario` builds the spawner enemy by hand (`game/server/index.js:743-755`) instead of calling `spawnEnemy(x, z, 'spawner')` and then overwriting `lastSpawnTime`. The hand-built literal already drifted from `spawnEnemy` once (it omits whatever extra fields a future enemy-init change might add), so it's a future maintenance trap.

### Acceptance Criteria
- `spawner-active` constructs the spawner via the shared `spawnEnemy()` helper, then mutates the resulting enemy's `lastSpawnTime` to backdate it.
- All existing server/integration tests still pass.

## `mixed-enemies` debug scenario is missing the spawner
The `mixed-enemies` scenario (`game/server/index.js:724-736`) spawns one of each enemy type "for visual verification" but was not updated when the spawner type landed — it still only spawns grunt + skirmisher + miniboss. Future visual-QA tickets that re-use this scenario will silently miss the spawner mesh.

### Acceptance Criteria
- `mixed-enemies` spawns one spawner in addition to the existing grunt/skirmisher/miniboss.
- The mesh of all four enemy types appears in `?debugScenario=mixed-enemies` capture.
