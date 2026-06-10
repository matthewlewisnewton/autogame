# Escort victory triggers on arrival alive, not on enemy clear

The escort objective currently only completes when the NPC reaches the destination AND every enemy is defeated / every scripted wave is cleared. Per the top-level ticket, reaching the extraction point with the NPC alive must itself be victory — surviving enemies along the route must not block completion.

## Acceptance Criteria

- `OBJECTIVE_DEFS.escort.isComplete` in `game/server/objectives.js` returns true when the escort has reached the destination and the escort has not failed — with NO requirement that `defeatedEnemies >= totalEnemies`. The `totalEnemies` / `defeatedEnemies` fields stay on the objective (HUD progress still works).
- `tickEscort` in `game/server/escort.js` calls the terminal-state callback whenever the escort is at the destination, regardless of scripted-wave state; the now-unused `areEscortWavesCleared` function and its export are deleted.
- `tickEscort` is added to the `module.exports` test-surface block in `game/server/index.js` (next to `updateScriptedEncounters`) so tests can drive the wired game-loop path.
- Tests in `game/server/test/escort_objective.test.js` prove a run reaches `status === 'victory'` when the escort arrives at the destination while ambush enemies are still ALIVE (scripted rooms uncleared), and all 8 pre-existing escort tests still pass (rewritten where they asserted the old wave-cleared requirement).
- `cd game && npx vitest run server/test/escort_objective.test.js` passes.

## Technical Specs

Files to change (only these):
- `game/server/objectives.js` — in `OBJECTIVE_DEFS.escort.isComplete` (~line 363): keep the `reachedDestination`/`run.escort.atDestination` guard and the `run.escort.failed` guard, then `return true;` — delete the `objective.defeatedEnemies >= objective.totalEnemies` return.
- `game/server/escort.js` — in `tickEscort` (~line 202): change `if (atDestination && areEscortWavesCleared(run))` to `if (atDestination)`; delete the `areEscortWavesCleared` function (~line 74) and remove it from `module.exports`.
- `game/server/index.js` — add `tickEscort` to the `module.exports` test-surface block (it is already imported from progression at ~line 319 and called in the game loop at ~line 1503; it is just not exported).
- `game/server/test/escort_objective.test.js` — rewrite the "escort destination complete" describe block (and any other assertion of the waves-cleared requirement) to leave scripted ambush enemies alive and assert victory on arrival; add/keep a test that the lobby run summary path sees `status === 'victory'`.

KNOWN TEST GOTCHA (cost a previous session two failed runs): asserting `run.status === 'victory'` purely via `tickEscort` imported from `../escort.js` FAILS — the ESM-imported escort.js instance does not have the `checkRunTerminalState` callback wired (progression wires it on its own CJS `require('./escort')` instance at progression.js:~3899). Either import `tickEscort` from `../index.js` (the wired path, once exported per above) or call the exported `checkRunTerminalState()` explicitly after ticking, as the pre-existing tests do.

## Verification: code
