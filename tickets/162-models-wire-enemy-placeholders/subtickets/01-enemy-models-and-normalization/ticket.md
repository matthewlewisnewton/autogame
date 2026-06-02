# Wire enemy placeholder models + add scale/ground normalization

Set the four enemy `MODEL_REGISTRY` paths to their committed `.glb` files and add
the per-model scale/ground-offset normalization to `attachRegistryModel` so the
loaded mesh renders at roughly the primitive's size and sits on the floor (feet at
the entity origin, not centered through the ground). The procedural fallback from
ticket 161 must remain intact.

## Acceptance Criteria

- `MODEL_REGISTRY` in `game/client/models.js` maps the four enemy keys to files
  under `/models/`:
  - `grunt` → `/models/grunt.glb`
  - `skirmisher` → `/models/skirmisher.glb`
  - `miniboss` → `/models/miniboss.glb`
  - `spawner` → `/models/spawner.glb`
- When a registry model is attached, it is normalized so its overall height
  approximately matches the procedural primitive's height (from `ENEMY_GEOMETRY`)
  and its base (bounding-box min Y) is grounded at the host's origin rather than
  intersecting/floating through the floor.
- The `player` registry path stays `null` (player remains procedural — owned by
  the character-customization epic 181–188).
- A null/missing/failed model path still falls back to the procedural mesh: the
  early-return-on-null behavior in `attachRegistryModel` and the null-result
  handling in `loadModel` are preserved, and the game starts/loads cleanly.
- Existing server + client tests pass (`pnpm test:quick` from `game/`).

## Technical Specs

- `game/client/models.js` — change the `grunt`, `skirmisher`, `miniboss`, and
  `spawner` values in `MODEL_REGISTRY` from `null` to their `/models/*.glb` paths.
  Leave `player` and all loot keys `null`.
- `game/client/renderer.js` — extend `attachRegistryModel` (and/or its callers
  `createEnemyMesh`) so that, after `loadModel` resolves a non-null scene, the
  model is normalized before/while being added to the host:
  - Derive the target height/footprint from `ENEMY_GEOMETRY[key]` (cone `height`
    or octahedron `radius`); reuse `enemyMeshHalfHeight` where helpful.
  - Compute the loaded model's bounding box (`THREE.Box3().setFromObject`), scale
    it uniformly so its height matches the target, then translate it so its
    bounding-box min Y aligns with the procedural mesh's base (feet on the
    ground). A small per-entity tuning map for scale/offset is acceptable if the
    bounding-box approach is insufficient.
  - Keep the existing behavior of hiding the procedural meshes' materials on
    successful swap and recording `host.userData.modelOverride`.
- Do NOT add, author, or re-export model files — they are already committed under
  `game/client/public/models/` (see `CREDITS.md`).

## Verification: code
