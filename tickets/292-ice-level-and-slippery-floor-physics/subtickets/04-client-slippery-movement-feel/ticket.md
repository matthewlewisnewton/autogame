# Client: slippery movement prediction parity

Update client-side fixed-tick movement prediction so local player motion on slippery floors matches server momentum physics from sub-ticket 01. Normal floors must remain indistinguishable from current HEAD prediction.

## Acceptance Criteria

- Client imports `sampleFloorSurface` and slippery tunables (`SLIPPERY_ACCEL`, `SLIPPERY_FRICTION`, etc.) from the same shared/config sources as the server.
- In `game/client/renderer.js` fixed-tick sim loop (`while (moveAccumulator >= TICK_DT)`):
  - **Normal** surface at `(simX, simZ)`: existing direct `tryPlayerMove(..., MOVE_SPEED * TICK_DT, ...)` path unchanged.
  - **Slippery** surface: maintains client `simVx` / `simVz` (module-level, reset on spawn/teleport); accelerates from movement input; coasts with slow deceleration when input stops; caps speed at `MOVE_SPEED`; uses `tryPlayerMove` with velocity-derived displacement each tick.
  - Wall collisions on slippery zero/project velocity consistently with the server.
- Transitioning between normal and slippery during a slide updates deceleration behavior on the next tick (no client-only speed desync > 1 tick step vs server on the lab layout).
- Spawn / layout reload / `setSimPosition` resets `simVx` and `simVz` to 0.
- Unit tests in `game/client/test/slippery_movement.test.js` (or `collision-hand.test.js`) tick the extracted prediction helper and assert: momentum carry after input release on slippery, immediate stop on normal when input ends.

## Technical Specs

- Extract a small pure helper (suggested: `game/client/movementPrediction.js`) mirroring the server slippery integration so tests do not need the full renderer.
- `game/client/renderer.js`: call the helper from the move accumulator loop; wire `simVx`/`simVz` lifecycle on spawn and debug-scenario re-seat paths.
- Reuse `sampleFloorSurface` from `game/shared/floorSampling.esm.js` (client import path).
- Constants: import from `game/server/config.js` via existing client re-export pattern, or duplicate in `game/shared/constants.json` if that is the project convention for cross-bundle values.
- Tests: `game/client/test/slippery_movement.test.js` with synthetic collider context matching server test fixtures.

## Verification: code
