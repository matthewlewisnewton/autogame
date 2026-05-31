# Sloped Movement (Server and Client)

Players should **walk up and down sloped floors** with correct vertical position
on both client prediction and server authority.

## Difficulty: hard

## Goal

Wire `sampleFloorY()` (from ticket 116) into movement so `player.y` tracks the
floor under the avatar during dungeon play, including ramps between rooms.

## Problem

Movement is 2D (`dx`/`dz` only); `player.y` is hardcoded to `0.5` in many
server paths (`progression.js`, `simulation.js`, move handler). Sloped geometry
without Y sync causes floating, sinking, or wall-collision false positives.

## Acceptance Criteria

- Server `move` handler (and any shared `tryPlayerMove` / collision path it uses)
  sets `player.y` from `sampleFloorY(layout, x, z)` after a valid horizontal move.
- Client local avatar Y matches the sampled floor for the local player during
  movement (same helper as server to avoid drift on flat ground).
- `stateUpdate` / public player snapshots include `y` and remote avatars render at
  the correct height.
- Walking from a flat room onto a sloped passage changes `y` smoothly (no single-tick
  teleport > 0.5 units unless stepping off a ledge — document max step if clamped).
- Existing wall collision, `isInsideDungeon`, and swept collision still pass; add
  regression tests if slope changes collision edge cases.
- Integration or socket test: emit `move` across a known ramp fixture and assert
  `player.y` increases (or decreases) in the expected direction.
- Spawn / reset / return-to-lobby still place players on valid floor height.

## Implementation Notes

- Depends on **116-sloped-floor-layout-and-geometry** (`sampleFloorY` + sloped
  layouts in `state.layout`).
- Keep horizontal collision logic; only add vertical snapping/clamping to floor.
- If the client sends `move` without `y`, server is authoritative for Y.
- Consider a small Y lerp on the client for remote players to reduce jitter.
- Key files: `game/server/index.js` (move handler), `game/server/simulation.js`,
  `game/client/main.js` (avatar position), `game/client/collision.js`.

## Verification

- `Verification: code` — unit + integration tests as above.
- Optional manual: walk up/down the test ramp in dev.

## Dependencies

- [116-sloped-floor-layout-and-geometry](tickets/116-sloped-floor-layout-and-geometry/)
