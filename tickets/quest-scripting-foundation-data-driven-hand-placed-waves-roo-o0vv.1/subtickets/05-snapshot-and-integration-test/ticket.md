# Wave snapshot exposure and scripted-quest integration test

Expose wave progress on the run snapshot for harness/client visibility and add an end-to-end unit test proving a fully scripted quest completes with no bulk spawns, satisfying the top-level acceptance criteria.

## Acceptance Criteria

- `stateSnapshot().run.waveScript` (or equivalent nested field) lists each wave `id`, `trigger`, and `status` (`pending` | `spawned` | `cleared`) while a scripted run is active.
- Snapshot updates as waves spawn and clear (status changes visible without reading server internals).
- Integration test: scripted `defeat_enemies` fixture with `run_start`, `enter_room`, and `waveCleared` waves; defeating all scripted enemies marks the run objective complete (`isRunObjectiveComplete`).
- Regression: deploying a standard unscripted quest (e.g. `training_caverns` tier 1) still performs weighted bulk spawn with `enemyCount` enemies and unchanged objective totals.
- No production quest is required to ship with `script.waves` yet; the fixture may live only in test `QUEST_DEFS` patch.

## Technical Specs

- **`game/server/questScript.js`**: Ensure `run.waveScript` is JSON-serializable and attached in `initQuestScript`; include a compact `waves: [{ id, trigger, status }]` array suitable for snapshots (omit internal ids if redundant).
- **`game/server/progression.js`**: Confirm `buildWorldSnapshot` passes through `run` unchanged (already includes `_gameState.run`); add `stateSnapshot` assertion helpers in tests only if needed.
- **`game/server/test/quest_script_integration.test.js`** (new): Full scripted run lifecycle — deploy, tick enter-room trigger, defeat waves in order, assert snapshot wave states and objective completion.
- **`game/server/test/quest_script_integration.test.js`** or **`game/server/test/quests.test.js`**: Assert an existing unscripted tier still has no `script` block and bulk spawn count unchanged.

## Verification: code
