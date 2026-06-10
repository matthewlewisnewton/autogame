# Move enemy sync into game/client/renderer/enemySync.js

Move the enemy-domain mesh sync out of `renderer.js` into a real module imported
by `renderer.js`. The `syncEnemyMeshes()` function plus its enemy-only helper
cluster and the minion-attribution VFX data table move to the new file; behavior
is unchanged. Depends on sub-ticket 06.

## Acceptance Criteria

- A new file `game/client/renderer/enemySync.js` exists and exports
  `syncEnemyMeshes(gs)`, with the function body unchanged in behavior.
- The enemy-only helpers and data used solely by enemy sync move into this module
  (e.g. `createEnemyMesh`, `createEnemyHitboxGroup`, `enemyMeshHalfHeight`,
  `ensureEnemyHealthBar`, `updateHealthBarMesh`, `ensureEnemyShieldBar`,
  `updateEnemyShieldBarMesh`, the windup/telegraph/variant/reveal/frenzied
  helpers, and the `MINION_HIT_VFX` / `MINION_HIT_VFX_DEFAULT` table). Shared
  cross-cutting helpers that other domains also use (`flashMesh`,
  `syncFlyingShadow`, `applySlowIndicator`, `applyBurnIndicator`,
  `syncLockOnRing`, `spawnDamageNumber`) and the mesh-map stores are imported,
  not duplicated.
- `enemySync.js` imports scene/map stores from `./rendererState.js` and the
  generic reconcile/dispose helpers from `./meshSync.js`; any remaining
  cross-cutting helpers are imported from `../renderer.js` and invoked only at
  call time (per-frame), which is safe under ES-module live bindings.
- `renderer.js` no longer defines `syncEnemyMeshes` locally — it imports it from
  `./renderer/enemySync.js` and `animate()` still calls it exactly once per frame.
- Enemy reconcile uses the shared helpers (`disposeStaleMeshes` for the parallel
  enemy maps; `syncMeshMap` for any single-map create/update/dispose reconcile
  where it cleanly applies) rather than a re-implemented inline loop.
- `pnpm test` (from `game/`) passes; game boots with enemies rendering, health
  bars, telegraphs, slow/burn markers, and minion-attribution hit VFX behaving as
  before (no console `pageerror`).

## Technical Specs

- New: `game/client/renderer/enemySync.js`.
- Edit: `game/client/renderer.js` — cut `syncEnemyMeshes` (currently ~lines
  6629–6763) and its enemy-only helper cluster; add
  `import { syncEnemyMeshes } from './renderer/enemySync.js'`. Export from
  `renderer.js` any cross-cutting helper that `enemySync.js` must import back
  (mark them call-time-only to keep the import cycle safe).
- Keep the data-table VFX structure from sub-ticket 02 intact (just relocate it).
- Do NOT touch any sub-ticket folder containing a `.passed` marker.

## Verification: code
