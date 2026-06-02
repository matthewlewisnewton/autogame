## Cross-reference the spike decision note from the ticket/beads record

The top-level AC asked for the decision note "in the ticket dir", but it correctly
lives at `game/docs/MODEL_SPIKE.md` (the `tickets/` tree is not committed game code).
To avoid future confusion when someone reads the beads ticket expecting the note
under `tickets/`, add a one-line pointer from the ticket/beads record (or a stub in
the ticket dir) to `game/docs/MODEL_SPIKE.md`.

### Acceptance Criteria
- The beads ticket `autogame-0yf` (or its notes) references `game/docs/MODEL_SPIKE.md`
  as the location of the decision note.

## Consider authoring the GLB via THREE's GLTFExporter

`scripts/generate-player-glb.mjs` hand-rolls the glTF JSON, bufferView/accessor
layout, and GLB chunk framing (~200 lines). This is correct and reproducible, but
duplicates serialization logic that `three/examples/jsm/exporters/GLTFExporter.js`
already provides (including morph target export). Migrating would shrink the script
and reduce the surface for binary-layout bugs in future edits.

### Acceptance Criteria
- `player.glb` is regenerated via a maintained glTF exporter (or the hand-rolled
  writer is documented as intentionally retained), and `playerModel.test.js` still
  passes against the regenerated asset.
