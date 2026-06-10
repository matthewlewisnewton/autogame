# 08 — Wave-cleared dialogue trigger hook

`endless_siege` tier 1 authors a `{ waveCleared: 5 }` radio beat, and `matchDialogueTrigger` already recognizes the trigger shape, but no gameplay code calls `fireQuestDialogue(..., { waveCleared: n })`. Wire the survive-objective defeat path so configured wave thresholds emit once per run.

## Acceptance Criteria

- When a `survive` run's `objective.defeatedEnemies` increments, the server evaluates `fireQuestDialogue(io, gameState, { waveCleared: defeatedEnemies })` (or equivalent) so matching `dialogue` entries emit.
- For `endless_siege` tier 1 (`totalSpawns: 10`), defeating the 5th attacker emits the authored half-siege line (`trigger: { waveCleared: 5 }`); the line does not fire at other counts.
- The beat fires once per run (existing `questDialogue.js` dedupe prevents re-emit on later defeats).
- `objective_complete` dialogue for survive runs still fires only when all attackers are defeated (unchanged).
- `cd game && pnpm test:quick` passes; `game/server/test/questDialogue.test.js` (or `server.test.js` survive section) asserts the wave-5 payload for `endless_siege` after five `recordEnemyDefeated` calls.

## Technical Specs

- **`game/server/progression.js`** — In `recordEnemyDefeated` (after `onEnemyDefeated` updates the objective), when `run.objective.type === 'survive'`, call `fireQuestDialogue(io, _gameState, { waveCleared: run.objective.defeatedEnemies })`. Use `getIoTarget()` like other dialogue hooks in this file.
- **`game/server/questDialogue.js`** — No matcher changes expected; confirm `waveCleared` key dedupe still works.
- **`game/server/objectives.js`** — Reference only if a cleaner hook belongs in `survive.onEnemyDefeated` instead of progression (keep a single call site).
- **`game/server/test/questDialogue.test.js`** — Integration test: deploy `endless_siege` tier 1, call `recordEnemyDefeated` five times, assert one `QUEST_DIALOGUE` with `trigger.waveCleared === 5` and Marshal Koss's authored text; sixth defeat does not re-emit wave 5.

## Verification: code
