# 05 — Escort objective type

Introduce a fourth quest objective kind where a friendly NPC must survive and reach an extraction landmark while the squad clears scripted escort waves — reusing minion follow AI rather than inventing a parallel entity system.

## Acceptance Criteria

- New `escort` entry in `OBJECTIVE_DEFS` (`game/server/objectives.js`) with `objectiveType: 'escort'`, `createObjective`, `isComplete`, `onEnemyDefeated`, and `skipBulkCombatSpawn` (escort quests use scripted waves from sub-ticket 01).
- Quest tier fields: `escortNpc: { name, maxHp? }`, `escortDestination: { landmark }` (or `roomRole: 'treasure'`), optional `escortFailOnDeath: true` (default true).
- On run start, spawn one escort entity attached to `run.escort` (implemented as a non-combat minion or dedicated `escort` record followed by `updateMinions` owner-follow logic in `game/server/simulation.js`).
- Escort follows the nearest living squad member when not under attack; escort death with `escortFailOnDeath` marks the run failed with a clear objective label.
- Reaching the destination landmark (distance threshold) while required waves are cleared completes the objective; `isComplete` returns true and normal victory flow runs.
- Escort state is captured/restored in run checkpoints alongside `run.scriptedEncounter`.
- `cd game && pnpm test:quick` passes, including `game/server/test/escort_objective.test.js`.

## Technical Specs

- **Edit:** `game/server/objectives.js` — register `escort` def; document in file header registry comment.
- **Add:** `game/server/escort.js` — `spawnEscortNpc(gameState, quest, layout)`, `tickEscort(gameState)`, `isEscortAtDestination(run, layout)`, `onEscortDamaged` / death handling.
- **Edit:** `game/server/simulation.js` — branch in minion update for `minion.isEscort` (no owner card binding; follow nearest active player; reduced or zero damage output).
- **Edit:** `game/server/progression.js` — call `spawnEscortNpc` on deploy for escort quests; game-loop `tickEscort`; checkpoint capture/restore for `run.escort`.
- **Edit:** `game/server/quests.js` — JSDoc for escort tier fields; `formatObjectiveSummary` escort line (e.g. "Escort {npc} to {destination}").
- **Edit:** `game/client/questBoard.js` — objective summary for `escort`.
- **Edit:** `game/client/renderer.js` — render escort NPC distinctly (reuse minion mesh path with flag).
- **Add:** `game/server/test/escort_objective.test.js` — follow behavior, death fail, destination complete.
- **Depends on:** sub-ticket `01-scripted-wave-encounter-engine` for combat pacing alongside escort.

## Verification: code
