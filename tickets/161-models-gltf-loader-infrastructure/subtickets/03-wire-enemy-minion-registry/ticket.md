# Wire enemy and minion mesh creation to the model registry

Refactor `createEnemyMesh` and `createMinionMesh` so they consult `MODEL_REGISTRY` and can swap in a loaded glTF clone when a path is set, while preserving today's synchronous procedural fallback and existing unit-test contracts.

## Acceptance Criteria

- `createEnemyMesh(type)` and `createMinionMesh(minionType)` import registry helpers from `models.js`.
- When `getRegistryModelPath(...)` is `null` (current registry state), both functions return the **same** procedural meshes as today — geometry type, dimensions, colors, emissive, and `_origEmissive` / `_origEmissiveIntensity` on enemies unchanged.
- When a registry path **is** set: return the procedural mesh immediately (so callers and `window.createEnemyMesh` tests stay synchronous), start `loadModel(path)` in the background, and on success replace the mesh's visible content with the cloned model (dispose procedural geometry/material as needed); on failure, keep the procedural mesh and emit the loader warning from sub-ticket 01.
- Missing/broken models never stall the render loop or throw from the animation frame.
- All existing `createEnemyMesh()` tests in `game/client/test/main.test.js` still pass unchanged.

## Technical Specs

- **Edit** `game/client/renderer.js`:
  - Import `getRegistryModelPath`, `loadModel` from `./models.js`.
  - Add a small internal helper (e.g. `attachRegistryModel(registryKey, placeholderObject3D, sceneRef?)`) that encapsulates the async swap-on-success pattern.
  - **Enemies:** map `type` → registry key (`grunt`, `skirmisher`, etc.); keep existing `ENEMY_GEOMETRY` procedural builder as fallback body.
  - **Minions:** map `minionType` → registry key (`ancient_wyrm`, `null_crawler`, `bulkhead_mauler`); keep `MINION_VISUAL` procedural builder as fallback.
  - Do **not** change player or loot mesh code in this sub-ticket.

## Verification: code
