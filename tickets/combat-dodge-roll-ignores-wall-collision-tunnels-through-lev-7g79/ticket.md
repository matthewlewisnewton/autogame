# combat: dodge roll ignores wall collision — tunnels through level geometry

## Difficulty: medium

## Goal

The dodge_roll key item (E) moves the player through solid walls. Repro: in any dungeon (Initiate Vault tier 1), hold W until pinned against the north wall of a room (position stops changing while the key is held), then press E. Observed: player position jumped from z=19.0 to z=5.2 — 13.8 units straight through the wall into the next area (verified via renderer getMeshMaps() player mesh, headless Playwright at localhost). Normal walking is correctly blocked by the same wall. Expected: the roll path should be clamped by the same collision used for walking. This lets players skip locked passages / scripted waves and can likely escape the map. Server-side roll displacement (keyItemEffects.js 'dodge_roll' case) appears not to run a collision sweep.

## Acceptance Criteria

- Dodging while facing a wall leaves the player on the near side of the wall (no net displacement through geometry); a server test covers dodge into a wall segment; dodge along open floor still travels its full distance.

## Verification

qwen failed (rc=-15)
qwen failed (rc=2)
