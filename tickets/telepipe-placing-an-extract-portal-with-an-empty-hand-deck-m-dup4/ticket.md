# telepipe: placing an extract portal with an empty hand/deck marks the run 'failed' (combat exhaustion) before the player can step through it

## Difficulty: medium

## Goal

REPRO (deterministic, 2/2 runs):
  cd game
  node ../harness/validate/playthrough.mjs --preset fire --steps full --out /tmp/fire
(ember_descent, Tier-1, defeat_enemies). The run reaches victory, then the telepipe-reset sub-step deploys a fresh sortie, depletes the hand/MS, places a telepipe, and tries to extract.

EXPECTED: stepping onto / placing the telepipe portal suspends the run (runStatus='suspended', returns to hub with a suspended checkpoint).
ACTUAL: the run transitions to runStatus='failed' (phase stays 'playing', extracted=false, suspendedRunSummary=null). Harness error:
  'Run did not suspend via telepipe: phase=playing runStatus=failed extracted=false suspendedRunSummary=null'
server.log shows '[telepipe] placed at (0.0, -46.5)' immediately before the failure.

ROOT CAUSE: Once the telepipe spell is CAST (placed), it is consumed from the hand. If the hand is otherwise empty and the deck + desperation deck are empty, isPlayerOutOfCards(player) becomes true (game/server/progression.js ~L2420). checkRunTerminalState (~L3506-3512) then sees every in-dungeon player as combat-exhausted with no cards and sets run.status='failed' (isPlayerCombatExhaustionFailureReady returns true immediately when out of cards, no grace — ~L3458). This fires during the portal-placement grace window, BEFORE the player walks through their own portal to extract. Result: a player who correctly placed an escape telepipe loses the run as a 'failure' instead of suspending it.

WHY IT MATTERS: telepipe is the intended 'I'm out of resources, let me bail out and resume later' tool. Failing the run the instant the telepipe is placed (because placing it emptied the last hand slot) defeats its purpose and is a player-facing loss/soft-lock-adjacent bug. Note: while telepipe is still IN hand the run is correctly not-exhausted (telepipe is castable), so the failure specifically races the placement->extraction transition.

FIX DIRECTION: suppress combat-exhaustion run-failure while a player has an active/placed telepipe portal pending extraction (or during the portal-placement grace), or defer the terminal check until after the portal extraction resolves.

DETERMINISM: reproduced in harness/tmp/qa-fire/run-summary.json and harness/tmp/qa-fire2/run-summary.json (both runStatus=failed). Note the ice full playthrough does NOT hit this because its post-deplete hand still retains deck-backed cards, so the player is never fully out-of-cards at portal time.

EVIDENCE: harness/tmp/qa-fire/run-summary.json, harness/tmp/qa-fire2/run-summary.json, harness/tmp/qa-fire/server.log

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
