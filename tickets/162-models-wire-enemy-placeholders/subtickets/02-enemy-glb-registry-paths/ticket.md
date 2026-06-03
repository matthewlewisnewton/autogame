# Enemy GLB registry paths (grunt, skirmisher, miniboss, spawner)

Set `MODEL_REGISTRY` paths for the four enemy types so `createEnemyMesh` loads
the committed CC0 placeholder `.glb` files instead of procedural cones/octahedrons
when assets resolve. Depends on sub-ticket 01 for scale/ground normalization.

## Acceptance Criteria

- `MODEL_REGISTRY` maps:
  - `grunt` → `/models/grunt.glb`
  - `skirmisher` → `/models/skirmisher.glb`
  - `miniboss` → `/models/miniboss.glb`
  - `spawner` → `/models/spawner.glb`
- `modelPathFor('grunt')` (and each enemy key) returns the path above.
- `createEnemyMesh(type)` still returns a procedural mesh synchronously; when the
  `.glb` loads, procedural materials are hidden and the normalized model is
  attached (per `attachRegistryModel` from ticket 161 + sub-ticket 01).
- `player` remains `null` in the registry.
- Minion registry keys (`ancient_wyrm`, `null_crawler`, `bulkhead_mauler`) remain
  `null`.
- Loot registry keys remain `null`.
- Committed files exist at `game/client/public/models/grunt.glb` (and the other
  three); do not author or re-export models.
- `enemyMeshHalfHeight()` values are unchanged (still driven by `ENEMY_GEOMETRY`).
- Existing `createEnemyMesh()` tests in `game/client/test/main.test.js` still pass
  (they assert synchronous procedural geometry).

## Technical Specs

- `game/client/models.js` — set the four enemy `MODEL_REGISTRY` values to
  `/models/<name>.glb` (Vite `publicDir` serves `public/` at web root).
- No changes to `renderer.js` unless a bugfix is required for enemy footprint
  lookup; normalization logic should already be in place from sub-ticket 01.
- Do not add or modify files under `game/client/public/models/` except verifying
  the four enemy `.glb` files are present (already committed per parent ticket).

## Verification: code
