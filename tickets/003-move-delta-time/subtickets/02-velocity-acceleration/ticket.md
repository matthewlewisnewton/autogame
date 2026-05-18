# Velocity Model with Acceleration

Replace instant position changes in `updateMyPlayer()` with a velocity-based approach: when a movement key is held, accelerate the velocity rather than moving directly.

## Acceptance Criteria
- `velocityX` and `velocityZ` variables replace direct `myX`/`myZ` increments
- When a key is held, velocity increases by `acceleration * delta` (acceleration constant around 15.0)
- Position is updated each frame by adding `velocity * delta`
- Movement ramps up smoothly instead of jumping to full speed
- Socket emit still sends `myX`/`myZ` positions (unchanged from parent ticket)

## Technical Specs
- **File to modify**: `game/client/main.js`
- Declare `let velocityX = 0, velocityZ = 0;` and `const acceleration = 15.0;` near existing movement constants
- In `updateMyPlayer()`, replace `myZ -= speed * delta` with `velocityZ -= acceleration * delta` (and same for X axis)
- After applying acceleration, update position: `myX += velocityX * delta; myZ += velocityZ * delta;`
- Keep friction at 1.0 for now (no deceleration yet — that's the next sub-ticket)

## Verification: visual
