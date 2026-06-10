# Create shared renderer-state + generic mesh-sync modules (foundation for the split)

Stand up the two shared modules the per-domain sync files will import, so the
domain extractions in 07–10 do not depend on circular imports for scene/map
access. Move the generic keyed-mesh-map reconcile/dispose helpers and the shared
keyed-mesh-map *stores* out of `renderer.js` into real files, and import them
back. Pure relocation — no rendering behavior changes.

## Acceptance Criteria

- A new file `game/client/renderer/meshSync.js` exists and exports the generic
  helpers `syncMeshMap`, `disposeStaleMeshes`, `disposeOne`, `disposeMeshMap`,
  moved verbatim (logic unchanged) from `renderer.js`.
- A new file `game/client/renderer/rendererState.js` exists and owns the shared
  keyed mesh-map stores (the `const xMeshes = {}` / marker-map objects currently
  declared near the top of `renderer.js`: `playersMeshes`, `playerShadows`,
  `playerNameplates`, `enemiesMeshes`, `enemyHealthBars`, `enemyShieldBars`,
  `enemyHitboxMeshes`, `enemyShadows`, `telegraphMeshes`, `minionTelegraphMeshes`,
  `enemyLockOnRings`, `variantMarkerMeshes`, `frenziedTelegraphMeshes`,
  `enemySlowMarkers`, `playerSlowMarkers`, `enemyBurnMarkers`, `playerBurnMarkers`,
  `minionsMeshes`, `minionShadows`, `spikeTrapMeshes`, `lootMeshes`,
  `iceBallMeshes`) and re-exports the existing `getScene()` accessor (or a thin
  `getScene` wrapper) so both `renderer.js` and the domain modules read the same
  scene/map references.
- `renderer.js` imports all of the above from the two new modules instead of
  declaring them locally; no duplicate declarations remain.
- `syncMeshMap`'s old `targetScene = scene` default is preserved in behavior by
  defaulting to `getScene()` (so existing call sites that omit the scene still
  add meshes to the live scene).
- `pnpm test` (run from `game/`) passes — the full renderer-adjacent Vitest
  suite is green and no module fails to resolve its imports.
- Game still boots and renders (no console `pageerror`, scene/avatars present).

## Technical Specs

- New: `game/client/renderer/meshSync.js`, `game/client/renderer/rendererState.js`.
- Edit: `game/client/renderer.js` — remove the moved declarations/helpers, add
  imports (`import { syncMeshMap, disposeStaleMeshes, disposeOne, disposeMeshMap }
  from './renderer/meshSync.js'` and the map stores + `getScene` from
  `./renderer/rendererState.js`). Keep `renderer.js`'s existing re-exports of
  `syncMeshMap`/`disposeOne`/etc. intact (re-export from the new module) so any
  other importer of these names from `renderer.js` keeps working.
- `getScene()` already exists in `renderer.js` (around line 1194); either move it
  into `rendererState.js` with a `setScene()` setter called during scene init, or
  keep it in `renderer.js` and have `rendererState.js` re-export it — pick the one
  that avoids a load-order trap (scene is a `let` assigned at init, maps are
  `const {}` assigned at module eval).
- Do NOT touch any sub-ticket folder containing a `.passed` marker.

## Verification: code
