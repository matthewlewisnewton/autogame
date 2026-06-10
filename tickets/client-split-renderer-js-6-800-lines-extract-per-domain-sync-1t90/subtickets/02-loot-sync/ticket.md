# Extract `lootSync` module

Move all loot pickup emission, mesh reconciliation, bob animation, and collection fade logic out of `renderer.js` into a dedicated `lootSync` module. `animate()` should call a small loot-sync entry point instead of inlining proximity checks and `syncLootMeshes()` calls.

## Acceptance Criteria

- New module `game/client/renderer/lootSync.js` owns: `tryEmitLootPickup` proximity flow (currently inlined at the top of `animate()`), `syncLootMeshes`, `animateLootMeshes`, `markLootCollected`, `updateCollectingLoot`, and related loot mesh helpers (`createLootMesh`, `getLootBaseY`, `disposeLootMeshMaterials`, `disposeAllLootMeshes`, `pruneLootPickupAttempts`).
- `renderer.js` re-exports any public loot helpers/tests still import from `../renderer.js` (e.g. `markLootCollected`, `syncLootMeshes`, `getPickedUpLootIds`, `pruneLootPickupAttempts`) so existing test imports do not break.
- `animate()` delegates loot proximity + mesh sync to `lootSync` (e.g. `lootSync.syncFrame({ gs, myId, myX, myZ, now })` and `lootSync.animateMeshes()`); no loot reconcile logic remains inline in `animate()`.
- Loot pickup radius, collection animation timing, magic-stone bob/pulse, and stale-loot → `markLootCollected` behavior are unchanged.
- `renderer-loot.test.js` and loot-related assertions in `main.test.js` pass.

## Technical Specs

- **Add** `game/client/renderer/lootSync.js` — accept renderer context (scene ref, mesh maps, socket ref for pickup emit) via a `createLootSync(ctx)` factory or explicit `initLootSync(ctx)` called from `initScene` / `setGameStateRef`.
- **Change** `game/client/renderer.js` — remove moved loot functions; import and wire `lootSync`; keep thin re-export wrappers for the public API surface tests use.
- **Unchanged behavior reference:** loot block at `renderer.js:6190–6198`, `syncLootMeshes` (~6041–6070), `animateLootMeshes` (~6129–6152), `markLootCollected` / `updateCollectingLoot` (~5829–5895).
- Prefer reusing `syncMeshMap` from sub-ticket 01 for the loot id reconcile loop if it fits without changing behavior; otherwise keep the existing stale-id → `markLootCollected` path verbatim.

## Verification: code
