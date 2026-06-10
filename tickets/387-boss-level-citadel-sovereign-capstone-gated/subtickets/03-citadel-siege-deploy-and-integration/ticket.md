# Citadel Siege deploy, encounter flow, and harness integration

Prove the capstone boss-level quest runs end-to-end through the existing boss-arena spawn pipeline, completes on active boss defeat, appears in reusable boss-level regression suites, and is reachable via a localhost debug shortcut for harness playthrough.

## Acceptance Criteria

- Deploying `citadel_siege` Tier 1 produces `run.objective.type === 'stage_boss'`, a dormant `run.encounter` with `bossEnemyId`, and exactly **one** enemy of type `citadel_sovereign` anchored to the `arena_dais` landmark (no bulk combat waves or scripted room spawns).
- Proximity activation transitions encounter `phase` to `active`; killing the active boss sets `objective.bossDefeated`, completes the run objective, and ends the run in `victory`.
- `boss_level_reuse.test.js` includes `citadel_siege` in `BOSS_LEVEL_QUESTS` and parametrized schema/spawn/defeat tests pass for all three live boss-level quests.
- Debug scenario `citadel-siege-boss` is registered in both `ALLOW_DEBUG_SCENARIOS` allowlists in `index.js` and deploys a normal `citadel_siege` run via `debugScenarios.js` (not a test fixture quest).
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/test/citadel_siege.test.js`** — Extend (or colocate) deploy/encounter/victory tests: `deployCitadelSiegeRun` helper using `generateLayout(seed, 'boss-arena')`, `spawnEnemies`, `startDungeonRun`; assert dormant spawn, `tryActivateEncounter` activation, boss kill → victory. Mirror structure from `crucible_duel.test.js` deploy section.
- **`game/server/test/boss_level_reuse.test.js`** — Add third entry to `BOSS_LEVEL_QUESTS` for `citadel_siege` / `citadel_sovereign` / `addCount: 0`.
- **`game/server/debugScenarios.js`** — Add `citadel-siege-boss` branch deploying `citadel_siege` Tier 1 through the normal quest selection + run-start path (same pattern as `crucible-duel-boss`).
- **`game/server/index.js`** — Add `'citadel-siege-boss'` to both debug-scenario name arrays.
- **`game/server/test/debug-scenarios.test.js`** — If scenario inventory is asserted, include the new name; optional smoke that the scenario is accepted when `ALLOW_DEBUG_SCENARIOS=1`.
- Depends on sub-tickets **01** and **02**.

## Verification: code
