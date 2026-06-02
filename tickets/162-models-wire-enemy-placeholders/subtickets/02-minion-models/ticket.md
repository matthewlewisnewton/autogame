# Wire minion placeholder models into the registry

Set the three minion `MODEL_REGISTRY` paths to their committed `.glb` files so the
loaded models render in place of the procedural primitives, reusing the
scale/ground-offset normalization added in sub-ticket 01. Procedural fallback must
remain intact.

## Acceptance Criteria

- `MODEL_REGISTRY` in `game/client/models.js` maps the three minion keys to files
  under `/models/`:
  - `ancient_wyrm` → `/models/minion-ancient-wyrm.glb`
  - `null_crawler` → `/models/minion-null-crawler.glb`
  - `bulkhead_mauler` → `/models/minion-bulkhead-mauler.glb`
- When attached, each minion model is normalized so its height approximately
  matches the minion's procedural primitive (from `MINION_VISUAL`, including the
  per-entry `scale` factor where present) and its base is grounded at the host
  origin rather than intersecting/floating through the floor.
- A null/missing/failed model path still falls back to the procedural minion mesh;
  the game starts/loads cleanly.
- Existing server + client tests pass (`pnpm test:quick` from `game/`).

## Technical Specs

- `game/client/models.js` — change the `ancient_wyrm`, `null_crawler`, and
  `bulkhead_mauler` values in `MODEL_REGISTRY` from `null` to their
  `/models/minion-*.glb` paths.
- `game/client/renderer.js` — ensure the normalization path added in sub-ticket 01
  (`attachRegistryModel`, called from `createMinionMesh`) derives its target
  height/footprint for minions from `MINION_VISUAL[minionType]` (shape
  `cylinder` → `height`, `octahedron` → `radius`, `box` → `height`, times the
  optional `scale`). Add minion-specific tuning entries only if the shared
  bounding-box normalization is insufficient; do not regress the enemy behavior.
- Do NOT modify enemy registry entries, the `player`/loot keys, or model files;
  do NOT author or re-export `.glb` assets.

## Verification: code
