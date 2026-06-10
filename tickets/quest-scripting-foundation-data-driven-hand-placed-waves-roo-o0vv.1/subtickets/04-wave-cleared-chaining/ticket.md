# Wave-cleared chaining

When every enemy spawned for a wave is defeated, mark that wave `cleared` and fire any waves whose trigger is `{ waveCleared: '<priorWaveId>' }`.

## Acceptance Criteria

- A `spawned` wave transitions to `cleared` only after all of its `spawnedEnemyIds` are gone from `gameState.enemies` (defeated/removed).
- A wave with `trigger: { waveCleared: 'wave_a' }` stays `pending` until `wave_a` is `cleared`, then spawns its entries once.
- Chains of three or more waves work in order (A → B → C).
- Clearing a wave does not re-fire waves already `spawned` or `cleared`.
- Unit test: three-wave chain (`run_start` → `waveCleared` → `waveCleared`); defeat enemies in sequence and assert each wave spawns only after the prior wave clears.

## Technical Specs

- **`game/server/questScript.js`**: Add `checkWaveCleared(gameState)`, `fireWaveClearedTriggers(gameState, ctx)`, shared `trySpawnWave(wave, ctx)` used by all trigger paths. Match `trigger.waveCleared` to prior wave `id`.
- **`game/server/progression.js`**: Invoke wave-cleared checks from `updateQuestScriptTriggers` and/or hook `recordEnemyDefeated` / post-`removeDeadEnemies` cleanup so chains advance on the same tick as the last kill.
- **`game/server/test/quest_script_wave_chain.test.js`** (new): Multi-wave fixture; programmatically remove/defeat spawned enemies; assert spawn order and final enemy totals.

## Verification: code
