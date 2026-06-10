# Add a generic syncMeshMap reconcile helper and apply it to simple sites

The keyed-mesh-map reconcile pattern (for each item: create-if-missing, then
position/update; afterward dispose meshes whose id left the snapshot) is inlined
~10 times in `animate()`. Introduce one generic `syncMeshMap` helper that
encapsulates create/update/disposeStale, and adopt it at the two simplest,
self-contained reconcile sites so the helper is proven before the larger domain
extractions build on it.

## Acceptance Criteria

- A new exported function `syncMeshMap(map, items, { key, create, update }, targetScene = scene)` exists in `game/client/renderer.js`.
- `syncMeshMap` computes the current id set from `items` via `key(item)`, creates a mesh with `create(item)` and adds it to the scene + stores it in `map` when one is missing for that id, calls `update(mesh, item)` for every item, and then disposes stale entries by delegating to the existing `disposeStaleMeshes(map, currentIds, targetScene)`.
- `syncMeshMap` defaults `key` to `(item) => item.id` when not supplied.
- The spike-trap hazard reconcile block in `animate()` is rewritten to call `syncMeshMap` (filtering to armed `spike_trap` enchantments for `items`, `create` = `createSpikeTrapHazardMesh`, `update` positions the mesh at `(enc.x, 0, enc.z)`); the standalone `currentSpikeTrapIds` Set and the trailing `disposeStaleMeshes(spikeTrapMeshes, ...)` call are removed.
- The ice-ball reconcile body inside `syncIceBallMeshes()` is rewritten to call `syncMeshMap` (`create` = `createIceBallMesh`, `update` positions at `(ball.x, ICE_BALL_HEIGHT, ball.z)`); the manual `currentIds` Set and trailing `disposeStaleMeshes` call are removed.
- Rendering behavior is unchanged: spike-trap and ice-ball meshes are still created, repositioned, and disposed exactly as before.
- Existing renderer tests pass, in particular `game/client/test/renderer-spike-trap.test.js`.

## Technical Specs

- File: `game/client/renderer.js` only.
- Add `syncMeshMap` near the existing `disposeStaleMeshes` / `disposeOne` helpers (around line 5842–5878) so it can reuse them. It must not change `disposeStaleMeshes` semantics.
- Reuse the module-scoped `scene` reference as the default target so callers need not pass it.
- Keep `createSpikeTrapHazardMesh`, `createIceBallMesh`, `ICE_BALL_HEIGHT`, and `spikeTrapMeshes`/`iceBallMeshes` maps as-is; only the reconcile control flow changes.
- Do NOT yet convert the enemy/minion/player reconcile sites — those are later sub-tickets that depend on this helper.

## Verification: code
