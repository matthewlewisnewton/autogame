# 06 — Fix crystal-rescue-extraction-phase debug scenario objective counters

The `crystal-rescue-extraction-phase` harness shortcut must mirror the real post-final-ambush extraction state, including objective enemy counters that count all nine defeated hostiles (six guard-wave + three ambush), not guard-only 6/6.

## Acceptance Criteria

- Running the `crystal-rescue-extraction-phase` debug scenario returns `{ ok: true, scenario: 'crystal-rescue-extraction-phase' }`.
- `objective.totalEnemies` equals `countScriptedEnemiesInQuest(quest) + countFinalAmbushEnemies(quest)` (9 for tier 1).
- `objective.defeatedEnemies` equals `objective.totalEnemies` (9/9), matching normal play after ambush clear.
- `objective.collectedItems === 3`, `finalAmbush.spawned === true`, `finalAmbush.cleared === true`, `extractionPhase === true`, `extractionReached === false`, and `state.enemies` is empty.
- Objective label is the extraction string (`return to the entry dock`).
- Player is placed away from the start/entry dock room.
- New test in `game/server/test/debug_scenarios_tier1.test.js` asserts the counter invariants via socket `debugScenario` emit.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/debugScenarios.js`** — In the `crystal-rescue-extraction-phase` branch (~line 1174):
  - Import `countFinalAmbushEnemies` and `countScriptedEnemiesInQuest` from `quests.js` (extend the existing `QUEST_DEFS` import block).
  - After `setupCrystalRescueTier1Deploy`, set `const questTier = QUEST_DEFS.crystal_rescue.tiers[1]` and compute `const fullEnemyTotal = countScriptedEnemiesInQuest(questTier) + countFinalAmbushEnemies(questTier)`.
  - Set `objective.totalEnemies = fullEnemyTotal` and `objective.defeatedEnemies = fullEnemyTotal` before marking extraction phase active.
  - Keep existing fields: `collectedItems`, `finalAmbush`, `extractionPhase`, `extractionReached`, `label`, player reposition to deepest combat room, and broadcast emits.
- **`game/server/test/debug_scenarios_tier1.test.js`** — Add a socket integration test for `crystal-rescue-extraction-phase` that asserts 9/9 counters and extraction-phase flags on `state.run.objective`. Share server setup with sub-ticket 05 if both land in the same file.

## Verification: code
