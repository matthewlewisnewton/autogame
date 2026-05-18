# Add THREE.Clock and Delta-Time Movement

Introduce `THREE.Clock` into the render loop and multiply the existing movement speed by `delta` so raw position changes are no longer tied to frame rate.

## Acceptance Criteria
- `THREE.Clock` instance is created before the `animate` loop
- `animate()` calls `clock.getDelta()` every frame
- Existing `speed` constant is multiplied by `delta` in `updateMyPlayer()` (e.g., `myX += speed * delta`)
- Movement still starts and stops instantly (no velocity model yet)
- Player movement appears roughly the same speed at different refresh rates

## Technical Specs
- **File to modify**: `game/client/main.js`
- Add `const clock = new THREE.Clock();` after the `speed` constant declaration
- In `animate()`, compute `const delta = clock.getDelta()` before calling `updateMyPlayer()`
- Pass `delta` into `updateMyPlayer(delta)` and multiply all `speed` uses: `myZ -= speed * delta`, etc.
- Do not change socket emit logic or server code

## Verification: visual
