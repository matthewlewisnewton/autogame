# Extract generic `syncMeshMap` keyed-mesh reconciler

Introduce a shared helper that implements the repeated create/update/disposeStale keyed-mesh-map pattern used throughout `renderer.js`. Migrate two self-contained consumers (ice-ball projectiles and spike-trap hazards) to prove the helper works before larger domain extractions land.

## Acceptance Criteria

- New module `game/client/renderer/syncMeshMap.js` exports `syncMeshMap(map, items, getId, create, update, scene)` (or equivalent signature) that: creates meshes for new ids, calls `update` for existing ids, and disposes stale entries via the existing `disposeStaleMeshes` / `disposeOne` utilities.
- `syncIceBallMeshes()` in `renderer.js` is rewritten to delegate its reconcile loop to `syncMeshMap`; ice-ball mesh create/update/dispose behavior is unchanged.
- The spike-trap hazard reconcile block inside `animate()` (currently ~lines 6747–6762) is moved to a `syncSpikeTrapMeshes()` function that uses `syncMeshMap`; only armed `spike_trap` enchantments get meshes, stale traps are disposed.
- Existing exports `disposeStaleMeshes`, `disposeOne`, and `disposeMeshMap` remain available from `renderer.js` for `main.js` and tests.
- `pnpm test:quick` passes; `renderer-spike-trap.test.js` and any ice-ball / mesh-map tests pass unchanged.

## Technical Specs

- **Add** `game/client/renderer/syncMeshMap.js` — generic reconciler; import `disposeStaleMeshes` from parent or colocate dispose helpers if already shared.
- **Change** `game/client/renderer.js` — import `syncMeshMap`; refactor `syncIceBallMeshes()`; extract `syncSpikeTrapMeshes()` from `animate()` spike-trap block; call `syncSpikeTrapMeshes()` from `animate()` in place of the inline loop.
- **Key detail:** `getId` extracts the stable string id from each state item; `create(item)` returns a new mesh and adds it to `scene`; `update(mesh, item)` sets position (and any per-frame fields). Stale disposal uses a `Set` of current ids built from `items`.
- Do not touch player, enemy, minion, or loot reconcile loops in this sub-ticket.

## Verification: code
