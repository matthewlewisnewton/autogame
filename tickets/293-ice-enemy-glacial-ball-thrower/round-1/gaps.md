1. Frost Crossing can spawn zero Glacial Throwers, so the ice level's signature enemy is not reliably present.
   Files: game/server/quests.js, game/server/progression.js, game/server/test/ice_enemy.test.js
   Fix: Guarantee at least one `glacial_thrower` in `frost_crossing` combat spawns, then draw the remaining enemies from the weighted pool; add a server spawn-pool test covering representative seeds.

2. In-flight ice-ball projectiles survive run-exit cleanup and can leak into lobby or next-run snapshots.
   Files: game/server/progression.js, game/server/game-state.js, game/client/renderer.js
   Fix: Clear `_gameState.iceBalls` in `resetTransientRunState()` and add a server test proving suspend/return/give-up cleanup broadcasts an empty projectile array.
