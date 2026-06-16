# escort: harness runObjectiveComplete flips true on enemy-clear before escort reaches destination

## Difficulty: easy

## Goal

REPRO (escort_objective_fixture via debug scenario 'escort-near-destination'):
1. Deploy escort run; escort NPC (Archivist Vale) spawns near the start, destination is the arena_dais ~8.5 units away.
2. Kill the single wave-0 grunt WITHOUT moving the escort to the dais.
3. Read window.__AUTOGAME_HARNESS_STATE__().

OBSERVED (captured snapshot):
  enemies: 0, objective.defeatedEnemies: 1/1
  runStatus: 'playing'           <-- server: run NOT complete (escort still at x=8.5, dais ~x=0)
  runObjectiveComplete: TRUE     <-- WRONG
  player-facing objective HUD text is correct: '...ambush 1/1 cleared · en route to extract'

EXPECTED: runObjectiveComplete must mirror the server's escort completion (escort.atDestination / objective.reachedDestination AND not failed), i.e. FALSE until the escort actually reaches the destination.

ROOT CAUSE: game/client/main.js (~L4900-4906) computes runObjectiveComplete for escort objectives by falling through to the defeatedEnemies >= totalEnemies branch; it never checks objective.reachedDestination / run.escort.atDestination for type 'escort'. (objective.reachedDestination IS in run.objective server-side; see OBJECTIVE_DEFS.escort.isComplete in game/server/objectives.js which gates on reachedDestination/atDestination.)

IMPACT: This is the test-instrumentation field automated escort playthroughs poll. It produces a FALSE PASS — a validator that waits on runObjectiveComplete will believe the escort completed the moment the last ambush enemy dies, even though the escort never moved to the destination and the server run is still 'playing'. Likely why escort validation has been unreliable. Player-facing HUD is unaffected.

EVIDENCE: harness/tmp/escort-qa/ (escort-play.mjs, escort-clear-then-escort.mjs, escort-escort-near-destination-state.json, escort-clear-then-state.json).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
