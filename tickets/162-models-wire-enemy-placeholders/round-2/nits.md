## Refresh Registry Attachment Comments

`game/client/renderer.js` still has comments around `attachRegistryModel()` that describe the older null-registry sub-ticket state. The runtime behavior is correct, but the comments now contradict the wired enemy/minion model paths and can mislead future model work.

### Acceptance Criteria
- Comments around `attachRegistryModel()` accurately describe current non-null enemy/minion registry paths plus procedural fallback behavior.

## Improve Visual Capture Coverage For Minions

The round-2 fallback capture shows enemy placeholder models in normal dungeon play but does not spawn any minions. Future visual model tickets would be easier to review if the capture plan includes a normal gameplay summon path or existing summon scenario that renders at least one minion model.

### Acceptance Criteria
- A visual capture path for model-registry tickets includes at least one enemy and at least one summoned minion mesh.

## Collapse redundant minion footprint branch

In `game/client/renderer.js`, `getRegistryTargetFootprint` computes the minion target height with an `if (minion.shape === 'box') { ... } else { ... }` whose two branches are identical (`targetHeight = minion.height`). Only the `octahedron` branch differs, so the `box`/`else` split is dead and can be folded into one default path for clarity.

### Acceptance Criteria
- The `box`/`else` duplication in `getRegistryTargetFootprint` is collapsed while preserving the octahedron special-case.
- `client/test/renderer-registry-normalize.test.js` still passes unchanged.

### Stale docstring note (also stale)
The `attachRegistryModel()` docstring still claims "In this sub-ticket every registry path is null, so the early return always fires and visuals are byte-identical to before" — now false. Covered by the "Refresh Registry Attachment Comments" nit above; fix together.
