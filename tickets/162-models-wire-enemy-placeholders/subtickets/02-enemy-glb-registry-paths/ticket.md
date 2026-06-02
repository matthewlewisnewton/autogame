# Wire enemy GLB paths into MODEL_REGISTRY

Register the four committed CC0 enemy placeholder `.glb` files in
`MODEL_REGISTRY` so `createEnemyMesh` async-swaps primitives for loaded models via
the normalization added in sub-ticket 01. Do not touch minion keys, loot keys, or
the player entry.

## Acceptance Criteria

- `MODEL_REGISTRY` maps each enemy type to a web-root path under `/models/`:
  - `grunt` → `/models/grunt.glb`
  - `skirmisher` → `/models/skirmisher.glb`
  - `miniboss` → `/models/miniboss.glb`
  - `spawner` → `/models/spawner.glb`
- `player` remains `null` (hero stays procedural for epic 181–188).
- Minion and loot registry values remain `null`.
- `MODEL_FIT` entries for the four enemy keys remain aligned with `ENEMY_GEOMETRY`
  (adjust only if a loaded asset’s bounds require a small per-type tweak).
- Failed/missing enemy model load still leaves the procedural cone/octahedron visible
  (existing `attachRegistryModel` resilience).
- Existing server + client unit tests pass (`pnpm test` from `game/`).

## Technical Specs

- `game/client/models.js`:
  - Set the four enemy keys in `MODEL_REGISTRY` to the `/models/<file>.glb` paths
    listed above. Files already live under `game/client/public/models/` per
    `CREDITS.md` — do not add or re-export assets.
- `game/client/renderer.js`:
  - Only touch `MODEL_FIT` if enemy-specific tuning is needed after wiring paths;
    do not change procedural geometry/material definitions in `ENEMY_GEOMETRY`.
- No server changes. No changes to `createPlayerAvatar` or minion/loot mesh builders
  beyond what the registry consult already does.

## Verification: code
