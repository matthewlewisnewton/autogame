# Enemy Wander AI

Implement a wander behavior for enemies whose `state` is `'idle'`. Each tick, an idle enemy picks (or keeps) a random target position within world bounds and moves a small step toward it. Once the enemy reaches that target, it picks a new one. This gives enemies organic-looking movement even when no players are nearby.

## Acceptance Criteria
- Enemies with `state === 'idle'` move each server tick toward a wander target
- The wander target is a random position within `[-20, 20]` on both x and z axes
- When an enemy reaches its current wander target (within 0.5 units), a new random wander target is chosen
- Movement speed for wandering is modest (≈1 unit per second) so enemies don't zip across the map

## Technical Specs
- **File**: `game/server/index.js`
- Extend each enemy object with `wanderTarget: { x, z }` and `wanderTimer` fields in `spawnEnemies()`
- Inside the existing game-loop `setInterval`, add an `updateEnemies()` call that iterates `gameState.enemies`:
  - If enemy `state === 'idle'`, move it toward `wanderTarget` at `WANDER_SPEED = 1` (units/sec, scaled by `1/TICK_RATE`)
  - If distance to `wanderTarget` < 0.5, pick a new random `wanderTarget` in `[-20, 20]`
- Use `Math.hypot(dx, dz)` for distance; normalize direction vector before applying speed

## Verification: code
