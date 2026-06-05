1. Abandoning a suspended run returns players to the quest layout spawn, which is outside the hub while lobby movement is bounded to `HUB_LAYOUT`.
   Files: `game/server/progression.js`, `game/server/test/server.test.js` or `game/server/test/lobby_hub_movement.test.js`
   Fix: In `abandonSuspendedRun()`, use `hubSpawnPosition(HUB_LAYOUT)` and `sampleFloorY(HUB_LAYOUT, ...)`, then add a regression test that abandoned suspended runs leave players inside hub walkable geometry.
