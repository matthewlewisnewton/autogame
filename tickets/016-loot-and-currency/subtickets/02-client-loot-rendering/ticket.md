# Client Loot Rendering

Render each loot item in `gameState.loot` as a small gold coin (rotating
cylinder or flat disc) in the 3D scene. Fix the `disposeAllLootMeshes()` bug
that fires on every remote player disconnect.

## Acceptance Criteria
- A module-level `const lootMeshes = {};` maps loot `id` → Three.js mesh group
- On every animation frame (or on `stateUpdate`), the client reconciles
  `gameState.loot` against `lootMeshes`:
  - New loot IDs → create a gold-colored mesh at `{x, 0.5, z}` and add to scene
  - Missing loot IDs → remove mesh from scene and dispose geometry/material
- Each loot mesh is a small, flat, gold-colored disc (e.g.
  `CylinderGeometry(0.4, 0.4, 0.1, 16)`) with `color: 0xffd700` and an
  emissive glow
- Loot coins bob up and down slightly (e.g.
  `Math.sin(performance.now() / 300) * 0.15`) and rotate slowly on the Y axis
- `disposeAllLootMeshes()` is **NOT** called in the `playerDisconnected` socket
  handler; it is only called on actual scene teardown (e.g. local disconnect or
  explicit cleanup)

## Technical Specs
- **File**: `game/client/main.js`
- Add `const lootMeshes = {};` near the other mesh-tracking maps
  (`playersMeshes`, `enemiesMeshes`, `minionsMeshes`)
- Create `function syncLootMeshes()` that iterates `gameState.loot`,
  adds/removes meshes, and is called inside the `animate()` loop (or on
  `stateUpdate`)
- Reuse a shared `THREE.MeshStandardMaterial` for performance (similar to how
  `floorMaterial` / `wallMaterial` are shared)
- Remove the `disposeAllLootMeshes()` call from the
  `socket.on('playerDisconnected', ...)` handler (currently at line ~378).
  Remote player disconnect is not a scene teardown — keeping it causes all loot
  meshes to flicker off and back on each frame.

## Verification: code
