# 02 — Client passage gate meshes

Render a visible themed gate (slab or forcefield) at each locked passage so players can see why a doorway is blocked. Gate meshes must stay in sync with `run.passageLocks` from server `STATE_UPDATE` payloads and disappear when a lock clears.

## Acceptance Criteria

- While `run.passageLocks` contains an entry with `locked: true`, the client scene includes a gate mesh spanning that passage doorway gap (oriented along the passage axis, sized from `layout.passageWidth` / doorway math matching `computePassageBarrierAABBs` in `game/client/dungeon.js`).
- When a lock entry flips to `locked: false` (or is removed), the corresponding gate mesh is removed from the scene on the next `STATE_UPDATE` / `syncPassageLockColliders` pass.
- Gate appearance uses dungeon theme materials (profile accent / passage wall colors from `game/shared/dungeonTheme.json`) so it reads as a PSO-style energy door, not invisible collision-only blocking.
- Locked gates do not break existing dungeon mesh rebuild (`rebuildDungeonLayout`) or client prediction colliders (`syncPassageLockColliders` still updates `wallColliders`).
- `cd game && pnpm test:quick` passes, including a new unit test that asserts gate mesh count tracks locked passage count.

## Technical Specs

- **Edit:** `game/client/dungeon.js` — add `buildPassageGateMesh(layout, passageIndex, materials)` (or similar) returning a `THREE.Group` positioned at the passage midpoint with width/depth from existing barrier AABB helpers.
- **Edit:** `game/client/renderer.js` — add `passageGateMeshes` map keyed by `passageIndex`; export `syncPassageLockGates(passageLocks, layout)` called alongside `syncPassageLockColliders` when `run.passageLocks` changes; tear down gates in `rebuildDungeonLayout` / scene reset paths.
- **Edit:** `game/client/main.js` — in the `STATE_UPDATE` handler (near existing `syncPassageLockColliders(state.run?.passageLocks)` call), invoke `syncPassageLockGates`.
- **Add:** `game/client/test/passage-gate-meshes.test.js` — feed a minimal layout + `passageLocks` array; assert `syncPassageLockGates` creates one mesh per locked passage and removes it when unlocked.

## Verification: code
