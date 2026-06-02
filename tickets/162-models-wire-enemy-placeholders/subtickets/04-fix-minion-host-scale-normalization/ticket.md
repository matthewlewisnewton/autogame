# Fix minion registry model double-scaling under host scale

`createMinionMesh` applies `MINION_VISUAL.scale` to the host mesh before
`attachRegistryModel` parents the loaded glTF under it. `getRegistryModelTarget`
currently multiplies minion height/footY by that same scale factor, so
`ancient_wyrm` (scale 1.5) is normalized to 2.25 local height and then scaled
again by the host → ~3.375 world height with its foot sunk below the floor.
Make normalization host-local so the inherited host scale is applied exactly once.

## Acceptance Criteria

- For minion keys, `getRegistryModelTarget` returns height and footY from base
  `MINION_VISUAL` geometry only (cylinder/box/octahedron dimensions), **without**
  multiplying by `minion.scale`; the host mesh's `scale.setScalar(visual.scale)`
  supplies world sizing.
- After `normalizeRegistryModel` and `host.add(model)`, an `ancient_wyrm` model
  parented under a host with scale 1.5 has world-space bounding-box height
  ~2.25 (1.5 geometry height × 1.5 host scale) and its bbox minimum Y matches
  the procedural cylinder foot plane (~−1.125 in world space, i.e. −0.75 in host
  local space).
- `null_crawler` and `bulkhead_mauler` (implicit scale 1) remain correctly sized
  and grounded; enemy keys in `getRegistryModelTarget` are unchanged.
- A unit test asserts `getRegistryModelTarget('ancient_wyrm')` returns
  `{ height: 1.5, footY: -0.75 }` and that `normalizeRegistryModel` on a dummy
  mesh under a scale-1.5 host yields the expected world-space height and foot Y.
- `cd game && pnpm test:quick` completes with no failures.

## Technical Specs

- `game/client/renderer.js`:
  - In `getRegistryModelTarget`, remove the `* scale` factors from the minion
    branch (lines ~270–277). Use `minion.height`, `minion.radius`, etc. directly
    so targets are in host-local space before `createMinionMesh` host scaling.
  - Do **not** change `createMinionMesh`, `attachRegistryModel`, enemy geometry
    branch, or `MINION_VISUAL` table values.
  - Alternative (only if needed): divide computed scale/position by the host's
    local scale inside `normalizeRegistryModel` — prefer the simpler target fix.
- `game/client/test/renderer-normalization.test.js` (new) or extend an existing
  renderer test file — import `getRegistryModelTarget` and
  `normalizeRegistryModel` from `../renderer.js`; use a `THREE.Mesh` stand-in
  with known bbox, parent under a host with `scale.setScalar(1.5)`, assert world
  bbox height and min Y for `ancient_wyrm`. Also assert `null_crawler` target
  unchanged.

## Verification: code
