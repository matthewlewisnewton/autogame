# Friction and Smooth Deceleration

Apply a friction multiplier to velocity every frame so the player coasts to a stop when no movement keys are pressed, completing the velocity model.

## Acceptance Criteria
- A `friction` constant (around 0.88) is applied to `velocityX` and `velocityZ` every frame
- When no movement key is held, velocity decays smoothly toward zero
- Player coasts to a stop rather than halting instantly on key release
- Combined with previous sub-tickets, full movement feels smooth: ramp up on press, coast on release

## Technical Specs
- **File to modify**: `game/client/main.js`
- Add `const friction = 0.88;` near the acceleration constant
- At the end of `updateMyPlayer()`, apply `velocityX *= friction;` and `velocityZ *= friction;` every frame (not just when no key is held — this creates continuous damping)
- Remove the old `const speed = 0.1;` constant since it is no longer used
- Final constants: `acceleration = 15.0`, `friction = 0.88`

## Verification: visual
