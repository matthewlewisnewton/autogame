1. `ice-cavern-stage` debug scenario can show an ice layout without selecting or deploying the real Frost Crossing quest.
   Files: `game/server/debugScenarios.js`, `game/server/index.js`
   Fix: Remove this URL scenario, or make it delegate to the `frost-crossing-tier-1` path so it sets `selectedQuestId = 'frost_crossing'`, applies the quest layout, spawns enemies, and starts the real run/objective.

2. `slippery-floor-lab` debug scenario creates a synthetic layout/end-state that is not reachable through normal gameplay.
   Files: `game/server/debugScenarios.js`, `game/server/index.js`
   Fix: Remove it as a URL debug scenario or convert it to use the real Frost Crossing deploy path and place the player on a production `floorSurface: 'slippery'` ice room.
