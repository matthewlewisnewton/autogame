1. Vitest coverage run is failing: `debugScenario — canyon-descent-tier-2` expects the placed miniboss to have 1 HP, but it remains at 300 HP.
   Files: game/server/debugScenarios.js, game/server/test/debug-scenarios.test.js
   Fix: restore the canyon-descent-tier-2 debug scenario setup so the miniboss selected by the scenario is reduced to 1 HP before the state update, then rerun the harness/vitest checks green.
