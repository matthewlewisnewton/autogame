# Client: gate escort runObjectiveComplete on destination arrival

`__AUTOGAME_HARNESS_STATE__()` in `game/client/main.js` treats escort objectives like generic kill-count objectives, so `runObjectiveComplete` flips true the moment the last ambush enemy dies even when the escort NPC has not reached the destination. Add an explicit `escort` branch that mirrors the server's `OBJECTIVE_DEFS.escort.isComplete` logic.

## Acceptance Criteria

- For `objective.type === 'escort'`, when `defeatedEnemies >= totalEnemies` but `run.objective.reachedDestination` is false and `run.escort.atDestination` is false, `runObjectiveComplete` is **false** (matches the escort-near-destination repro: enemies cleared, run still `playing`).
- For `objective.type === 'escort'`, when `run.objective.reachedDestination === true` **or** `run.escort.atDestination === true`, and `run.escort.failed` is not true, `runObjectiveComplete` is **true**.
- For `objective.type === 'escort'`, when `run.escort.failed === true`, `runObjectiveComplete` is **false** regardless of destination or enemy counts.
- Existing `collect_items`, `stage_boss`, and default `defeatedEnemies >= totalEnemies` branches are unchanged for non-escort objective types.

## Technical Specs

- **`game/client/main.js`** — inside `window.__AUTOGAME_HARNESS_STATE__` (~L4899–4906), extend the `runObjectiveComplete` ternary chain with an `objective.type === 'escort'` branch **before** the final defeated-enemies fallback.
- Read destination/failure from live run state: `runObjective.reachedDestination`, `gameState.run.escort?.atDestination`, and `gameState.run.escort?.failed` (the trimmed harness `objective` snapshot does not currently expose `reachedDestination`).
- Mirror server logic from **`game/server/objectives.js`** `OBJECTIVE_DEFS.escort.isComplete` (L364–367): incomplete unless at destination; false when escort failed.
- Do **not** change player-facing HUD code (`game/client/objectiveHud.js`); it already handles escort progress correctly.

## Verification: code
