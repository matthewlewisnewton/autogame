# objectives: stage_boss objective counter increments on regular enemy kills

## Difficulty: medium

## Goal

On Frost Crossing tier 1 (objectiveType stage_boss, totalEnemies 1), killing an ordinary scripted Glacial Thrower incremented objective.defeatedEnemies from 0 to 1, producing the state {defeatedEnemies:1,totalEnemies:1,bossDefeated:false,label:'defeat the stage warden'} while encounter.phase was still 'dormant' and runStatus stayed 'playing'. The counter that is supposed to represent the boss kill is satisfied by any kill, so anything reading objective progress (HUD, harness probes, validation scripts) sees a 'complete' 1/1 objective on a run that is far from done. Repro: select Frost Crossing tier 1, launch, kill the first dock grunt or thrower, inspect objective state via window.__AUTOGAME_HARNESS_STATE__().

## Acceptance Criteria

- For stage_boss objectives, defeatedEnemies/totalEnemies only reflects the boss entity (or a separate boss progress field is used); killing non-boss enemies does not move the stage-boss objective counter; covered by a server test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
