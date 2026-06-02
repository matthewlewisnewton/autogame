1. `ancient_wyrm` minion model renders ~1.5× oversized and sunk below the floor.
   `createMinionMesh` sets `mesh.scale.setScalar(1.5)` on the host, then
   `attachRegistryModel` parents the loaded model under that host, so the model
   inherits the 1.5× scale. `getRegistryModelTarget` ALSO multiplies the minion
   branch by `scale`, so the scale is applied twice (height + foot offset).
   Files: game/client/renderer.js (getRegistryModelTarget ~line 268-277,
   normalizeRegistryModel ~line 289-302, createMinionMesh ~line 371-374).
   Fix: make normalization host-local — drop the `* scale` factors from the minion
   branch of getRegistryModelTarget (let the host's scale supply it), OR divide the
   model's computed scale/position by the host's local scale in normalizeRegistryModel.
   Verify ancient_wyrm matches the procedural cylinder footprint and foot plane.
