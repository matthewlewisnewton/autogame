# Per-run objective spawn seed (collect_items crystals)

Implement option (b): keep `questLayoutSeed`-driven geometry identical for every run of a quest+tier, but randomize **objective entity placement** per fresh deploy using a new per-run seed. Wire `collect_items` prism/crystal spawning (`spawnCrystals`) to the per-run RNG while leaving layout generation and scripted-wave RNG on the quest layout seed stream.

## Acceptance Criteria

- Fresh deploy (ready + Deploy from lobby) assigns a new integer `runSpawnSeed` on `gameState` before `spawnEnemies()` runs; it is **not** derived from `questLayoutSeed`.
- Two fresh deploys of the same quest+tier (e.g. `crystal_rescue` tier 1) produce **identical** `layout` room topology (same room count and matching room `x`/`z`/`width`/`depth` per index) but **different** `(x, z)` positions for quest-critical crystals (`loot` entries with `kind: 'crystal'`).
- Re-running `spawnCrystals` with the same `layout` and the same `runSpawnSeed` reproduces the same crystal positions (seeded determinism).
- `spawnCombatEnemies`, `spawnLoot`, and scripted wave contexts (`buildQuestScriptSpawnCtx`, `waveRng` in `scriptedEncounters.js`) continue to use `mulberry32(layoutSeed + 1000)` (or existing `waveRng(layoutSeed, …)`), **not** `runSpawnSeed`, so guard waves and bulk combat spawns stay layout-anchored.
- `stateSnapshot()` / world payload includes `runSpawnSeed` so clients and tests can observe it.
- Server logs on deploy still show the quest `layoutSeed`; crystal spawn logs (`[crystal] spawned …`) reflect per-run positions.
- New unit test file `game/server/test/quest_per_run_spawn.test.js` covers layout stability + crystal variance + same-seed reproducibility; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`**
  - In `checkAllReadyInner` fresh-deploy path (after `_applyLayoutForQuest`, before `spawnEnemies`): set `gameState.runSpawnSeed` via a small helper (e.g. `crypto.randomInt` or hash of `crypto.randomUUID()` → positive int).
  - Extend `buildObjectiveSpawnCtx()` to expose `objectiveRng: mulberry32(runSpawnSeed)` alongside existing ctx fields.
  - Refactor `spawnEnemies()`: derive `layoutRng = mulberry32(layoutSeed + 1000)` for `spawnCombatEnemies` / `spawnLoot`; pass `objectiveRng` into `def.spawnQuestEntities(…, objectiveRng, …)` (adjust signature as needed).
  - `buildQuestScriptSpawnCtx` keeps using `layoutRng` only.
  - `captureWorldState()` / `restoreCardCheckpoint` world restore: persist and restore `runSpawnSeed` alongside `layoutSeed`.
  - Export helper(s) needed by tests (e.g. `generateRunSpawnSeed`, or test-only seed injection).
- **`game/server/objectives.js`**
  - `collect_items.spawnQuestEntities`: call `ctx.spawnCrystals(layout, objectiveRng, crystalCount)` using the per-run RNG from ctx (not the layout RNG).
- **`game/server/progression.js`** (`spawnCrystals` function ~L2663)
  - No algorithm change required beyond receiving the per-run RNG; ensure it consumes the passed RNG for room shuffle and position jitter.
- **`game/server/index.js`**
  - Re-export any new test hooks if the test harness imports from `index.js`.
- **`game/server/test/quest_per_run_spawn.test.js`** (new)
  - Deploy `crystal_rescue` twice with different `runSpawnSeed`, same `questLayoutSeed`; assert layout rooms match, crystal coordinates differ.
  - Same `runSpawnSeed` twice → identical crystal coordinates.
- **Do not change** `questLayoutSeed` in `game/server/dungeon.js` or `applyLayoutForQuest` / `previewLayoutForQuest` behavior.

## Verification: code
