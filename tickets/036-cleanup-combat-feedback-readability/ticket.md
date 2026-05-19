# Cleanup nits from 029-combat-feedback-readability

> **Staleness note.** This follow-up ticket was written against commit
> `36b87fd` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `029-combat-feedback-readability`.
None blocked acceptance — clean them up when convenient.

## flashMesh saves emissive via non-existent THREE.Color API
`flashMesh` in `game/client/main.js` reads the original emissive with
`mat.emissive.get ? mat.emissive.get() : 0x000000`. `THREE.Color` has no `.get()`
method, so the original emissive is always treated as black. It works today only
because enemy/player materials use the default black emissive — any future mesh
with a non-black emissive would lose it after a flash.
### Acceptance Criteria
- `flashMesh` captures and restores the real original emissive (e.g. via `getHex()`).
- A flashed mesh with a non-black starting emissive returns to its original value.

## Hit-spark cleanup uses global scene instead of capture target
`spawnHitSpark` adds the spark to `window.___test_scene || scene`, but the cleanup
branch in `updateAttackEffects` calls `scene.remove(fx.mesh)`. Under the test scene
override these differ; harmless in production but inconsistent.
### Acceptance Criteria
- Hit-spark removal targets the same scene the spark was added to.

## Unbounded tracking maps for loot/card-hit timing
`previousLootValues` and `lastCardHitTime` in `game/client/main.js` accumulate one
entry per loot/enemy id and are never pruned, so they grow slowly over a long run.
### Acceptance Criteria
- Stale entries in `previousLootValues` and `lastCardHitTime` are removed once the
  corresponding loot/enemy no longer exists.
