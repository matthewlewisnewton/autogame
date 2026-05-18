# Delta-Time Movement

Fix frame-rate dependent movement so players move at the same speed regardless of monitor refresh rate.

## Acceptance Criteria
- Movement speed is consistent between 60Hz and 144Hz displays
- Uses `THREE.Clock` for delta time calculation
- Velocity model with acceleration and friction replaces instant position changes

## Technical Specs
- **File to modify**: `game/client/main.js`
- Add `const clock = new THREE.Clock()` before the animate loop
- In `animate()`, get `const delta = clock.getDelta()`
- Replace `myX += speed` with velocity model: `velocity.x += acceleration * delta` when key held, `velocity.x *= friction` each frame
- Constants: `acceleration = 15.0`, `friction = 0.88`
- Send `myX` / `myZ` to server same as before (no server changes)
