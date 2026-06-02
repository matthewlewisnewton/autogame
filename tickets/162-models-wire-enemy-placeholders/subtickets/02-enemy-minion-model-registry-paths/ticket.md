# Wire enemy and minion placeholder paths into MODEL_REGISTRY

Set non-null `/models/*.glb` paths in `MODEL_REGISTRY` for all seven enemy and
minion entity keys so `attachRegistryModel` loads the committed CC0 placeholders
instead of leaving procedural meshes visible. Depends on sub-ticket 01 for correct
scale and grounding.

## Acceptance Criteria

- `MODEL_REGISTRY` maps exactly these keys to paths under `/models/`:
  - `grunt` → `/models/grunt.glb`
  - `skirmisher` → `/models/skirmisher.glb`
  - `miniboss` → `/models/miniboss.glb`
  - `spawner` → `/models/spawner.glb`
  - `ancient_wyrm` → `/models/minion-ancient-wyrm.glb`
  - `null_crawler` → `/models/minion-null-crawler.glb`
  - `bulkhead_mauler` → `/models/minion-bulkhead-mauler.glb`
- `player`, `currency`, `crystal`, and `magic_stone` remain `null` (hero and loot
  unchanged).
- `createEnemyMesh` and `createMinionMesh` still call `attachRegistryModel` with
  the same keys; no changes to player avatar or loot mesh creation.
- When the `.glb` files are present under `game/client/public/models/`, async load
  hides the procedural mesh and shows the normalized model from sub-ticket 01.
- No new models are authored, exported, or committed beyond the paths already
  specified in `CREDITS.md`.

## Technical Specs

- `game/client/models.js` — set the seven registry string values above; leave
  `player` and loot keys as `null`.
- Do not modify `game/client/renderer.js` except if a one-line import/export is
  required (prefer models-only diff).
- Asset filenames must match files in `game/client/public/models/` per
  `CREDITS.md` (`grunt.glb`, `skirmisher.glb`, etc.).

## Verification: code
