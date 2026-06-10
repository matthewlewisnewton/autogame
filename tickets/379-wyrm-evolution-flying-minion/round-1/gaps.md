1. `archive-wyrm-elevated-breath` creates an impossible elevated grounded grunt state by setting `elevated.y = floorY + 5` on a non-flying enemy; normal simulation floor-snaps grounded enemies each tick.
   Files: `game/server/debugScenarios.js`, `game/server/simulation.js`
   Fix: Change the scenario to use a normally reachable elevated target state, such as a flying/elevated enemy with `flying`/`altitude` fields or a legitimate vertical-layout position whose sampled floor supplies the height.
