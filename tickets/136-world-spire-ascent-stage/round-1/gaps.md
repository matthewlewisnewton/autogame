1. Elevated flat spire tiers render at the legacy ground height instead of their `floorCorners` Y, so the visible tower is not actually stacked.
   Files: `game/client/dungeon.js`, `game/client/test/dungeon.test.js`
   Fix: In the uniform-floor render path, position flat room floor meshes and treasure markers at the room's sampled/equal floor Y; add a test for an elevated uniform room.

2. The final tier does not hold the run objective or an exit; defeat-objective enemies spawn only in combat tiers, leaving the top treasure tier non-interactive.
   Files: `game/server/dungeon.js`, `game/server/progression.js`, `game/server/test/dungeon.test.js`, `game/server/test/server.test.js`
   Fix: Put a counted objective target, boss, or exit interaction on the final `treasure` tier for `spire-ascent`, and test that the normal `spire_ascent` quest requires reaching/completing that final-tier objective.
