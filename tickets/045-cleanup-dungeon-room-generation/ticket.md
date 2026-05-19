# Cleanup nits from 015-dungeon-room-generation

> **Staleness note.** This follow-up ticket was written against commit
> `272d873` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `015-dungeon-room-generation`.
None blocked acceptance — clean them up when convenient.

## Redundant dungeonMeshes reset in initScene

In `game/client/main.js` `initScene()`, `clearDungeon(scene, dungeonMeshes)`
already empties the `dungeonMeshes` array, so the immediately following
`dungeonMeshes.length = 0` before `dungeonMeshes.push(...meshes)` is dead.
Harmless but confusing — drop the redundant line.

### Acceptance Criteria
- The redundant `dungeonMeshes.length = 0` between `clearDungeon(...)` and
  `dungeonMeshes.push(...meshes)` in `initScene()` is removed.
- Client tests still pass.
