# Wire minion GLB paths and confirm fallback + player unchanged

Register the three committed CC0 minion placeholder `.glb` files in
`MODEL_REGISTRY` and add a focused client test that proves a broken registry path
still falls back to the procedural mesh. Completes the top-level ticket scope
(enemies were wired in sub-ticket 02).

## Acceptance Criteria

- `MODEL_REGISTRY` maps each minion type to a web-root path under `/models/`:
  - `ancient_wyrm` → `/models/minion-ancient-wyrm.glb`
  - `null_crawler` → `/models/minion-null-crawler.glb`
  - `bulkhead_mauler` → `/models/minion-bulkhead-mauler.glb`
- `player` remains `null`; enemy paths from sub-ticket 02 are unchanged.
- `MODEL_FIT` entries for the three minion keys match `MINION_VISUAL` dimensions.
- A client unit test (new or extended) stubs `loadModel` to resolve `null` for a
  registry key with a path set and asserts the procedural minion/enemy mesh material
  stays visible (no uncaught error, host not removed).
- Game starts and loads cleanly when a minion path is invalid (manual or test stub);
  procedural fallback is used.
- Existing server + client unit tests pass (`pnpm test` from `game/`).

## Technical Specs

- `game/client/models.js`:
  - Set the three minion keys in `MODEL_REGISTRY` to the `/models/<file>.glb` paths
    above.
- `game/client/renderer.js`:
  - Tune `MODEL_FIT` for minions only if needed; minions are positioned at
    `y = 0.5` in the render loop — normalization should still ground feet at host
    origin so world placement stays consistent with primitives.
- `game/client/test/` (new `models-registry.test.js` or similar):
  - Import `MODEL_REGISTRY`, `loadModel` (mocked), and a mesh factory
    (`createMinionMesh` / `createEnemyMesh` via renderer export or `main.js` window
    hooks) to verify fallback when `loadModel` returns `null`.
  - Assert `MODEL_REGISTRY.player === null`.
- Do not add `.glb` files or change server simulation code.

## Verification: code
