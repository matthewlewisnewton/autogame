1. Sunken Canyon flat plateau/canyon floor meshes render at `FLOOR_Y` instead of their sampled `floorCorners` Y, so the live stage does not visually present the required two elevation bands.
   Files: game/client/dungeon.js, game/client/test/dungeon.test.js
   Fix: render uniform rooms with explicit non-default `floorCorners` at their sampled/constant Y, place treasure markers/passages consistently with sampled floor height, and add client tests for Sunken Canyon plateau/canyon floor mesh Y.
