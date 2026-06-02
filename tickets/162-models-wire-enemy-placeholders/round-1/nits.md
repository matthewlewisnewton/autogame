## Unit-test coverage for model scaling/grounding normalization

`normalizeRegistryModel` and `getRegistryModelTarget` (game/client/renderer.js) have no
direct tests. The existing suite covers only registry paths and the load-failure
fallback. A focused test would have caught the host-scale double-application on
`ancient_wyrm` before capture.

### Acceptance Criteria
- A test asserts `getRegistryModelTarget` returns the expected `{height, footY}` for at
  least one cone enemy, one octahedron enemy, and each minion shape (cylinder/octahedron/box).
- A test feeds a stub `Object3D` of known bounds to `normalizeRegistryModel` and asserts
  the resulting world-space height and foot Y match the procedural primitive for a scaled
  minion (`ancient_wyrm`) when parented under its scaled host mesh.

## Redundant branch in getRegistryModelTarget minion handling

The `box` branch and the trailing default branch of the minion section in
`getRegistryModelTarget` (game/client/renderer.js ~line 274-277) compute the identical
expression. Collapse them into a single return to reduce duplication.

### Acceptance Criteria
- The duplicated `box`/default minion return is collapsed to one path with no behavior change.
