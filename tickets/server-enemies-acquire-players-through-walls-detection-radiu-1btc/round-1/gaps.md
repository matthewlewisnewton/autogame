1. `enemy-behind-wall` debug scenario is not an equivalent normally reachable gameplay state: it chooses the longest Frost Crossing start-room wall, which is the exterior north wall, and places the enemy outside the walkable layout.
   Files: `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`
   Fix: Place the player/enemy across a real connector or adjacent-room wall/passage that an enemy can naturally occupy in Frost Crossing, and update the test to assert both entities are in walkable/valid gameplay space while LOS remains blocked.
