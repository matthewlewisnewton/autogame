# Fix direction change while sliding on ice

While coasting on a slippery floor after input release, applying perpendicular movement input must redirect velocity smoothly (`directionChangeWhileSliding` FAIL today). The player should curve toward the new input direction without a position teleport and without instant full stop.

## Acceptance Criteria

- On a slippery lab layout, after building eastward speed, releasing input for ≥3 coast ticks, then applying northward input for ≥6 ticks:
  - Total displacement per step stays bounded (no teleport; displacement < `8 * MOVE_SPEED / TICK_RATE`).
  - `player.vz` becomes positive (northward component gained).
  - Velocity dot product with the original east direction decreases (`dotAfter < dotBefore`).
  - `hypot(vx, vz)` remains > 0 throughout the redirect window.
- Existing `applyPlayerMovement() — slippery floors` acceleration and post-release coast behavior from sub-ticket 01 remain passing.

## Technical Specs

- **Primary:** `game/server/simulation.js` — `applyPlayerMovement()` slippery branch:
  - When `inputFresh` is true during an existing slide, add acceleration along the new input vector to `player.vx`/`player.vz` (do not reset velocity to zero on input direction change).
  - Respect analog input magnitude (`inputMag`) and `playerMoveSpeedScale` / slow modifiers when adding accel.
  - After integration, clamp to `maxSpeed`, displace via `tryPlayerMove`, and project velocity from actual displacement (preserve wall-collision velocity projection from sub-ticket 01).
- **Tests:** `game/server/test/slippery_floor.test.js` — `describe('slippery floor — direction change while sliding')` / `redirects velocity with perpendicular input without teleporting`; use `makeSlipperyLabLayout()`, fake timers, and `staleInputTime()` / `freshInputTime()` helpers.
- **Depends on:** sub-ticket 01 (momentum carry must work before redirect is observable).

## Verification: code
