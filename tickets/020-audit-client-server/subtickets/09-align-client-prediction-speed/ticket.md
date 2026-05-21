# Align Client Movement Prediction with Server Speed

The client predicts movement using an acceleration/friction model (`acceleration = 15`, `friction = 0.88`) that produces a terminal velocity far below the server's fixed `MOVE_SPEED = 12`. At steady state the client-side velocity settles around 6.4 units/s, so the server's authoritative position consistently outruns the client's prediction. This forces reconciliation to snap the player forward on every `stateUpdate`, producing visible stutter instead of hiding latency.

Fix: replace the client's acceleration/friction integration with a fixed-speed model that matches the server exactly — move at `MOVE_SPEED = 12` units/s in the input direction, capped by the same `MAX_ELAPSED_MS = 200` to prevent over-correction after input stalls.

## Acceptance Criteria
- The client's `updateMyPlayer()` function moves the local player at a constant speed matching the server's `MOVE_SPEED = 12` (units/s) in the direction of WASD input, instead of using acceleration/friction.
- The client caps the per-frame movement delta using `MAX_ELAPSED_MS = 200` (same value as the server), so a stalled `stateUpdate` does not cause the client to drift more than the server would have allowed.
- The `acceleration` and `friction` constants are removed from `game/client/config.js` and no longer imported in `main.js`.
- Normal movement feels smooth — the client's predicted position stays close to the server's authoritative position, so the `stateUpdate` reconciliation snap (drift > 0.5) rarely or never triggers during normal play.
- The reconciliation snap-back logic in `stateUpdate` remains unchanged — it still corrects drift > 0.5, but now only fires under edge cases (network hiccup, not every frame).

## Technical Specs
- **File**: `game/client/config.js` — Remove `acceleration` and `friction` exports. Add `MOVE_SPEED = 12` and `MAX_ELAPSED_MS = 200` constants (matching server values exactly).
- **File**: `game/client/main.js` — In `updateMyPlayer()`:
  1. Remove the acceleration/friction lines (`velocityZ -= acceleration * delta`, etc., and the `Math.pow(friction, ...)` damping).
  2. Compute movement direction from active keys, normalize to unit vector:
     ```js
     let dirX = 0, dirZ = 0;
     if (keys.w) dirZ -= 1;
     if (keys.s) dirZ += 1;
     if (keys.a) dirX -= 1;
     if (keys.d) dirX += 1;
     const mag = Math.hypot(dirX, dirZ);
     if (mag > 0) { dirX /= mag; dirZ /= mag; }
     ```
  3. Cap delta: `const cappedDelta = Math.min(delta, MAX_ELAPSED_MS / 1000);`
  4. Apply fixed speed: `myX += dirX * MOVE_SPEED * cappedDelta; myZ += dirZ * MOVE_SPEED * cappedDelta;`
  5. Keep the wall collision resolution call (`resolveWallCollisionFromDungeon`) unchanged.
  6. Derive `playerRotation` from the movement direction (not velocity): `if (mag > 0) playerRotation = Math.atan2(dirZ, dirX);`
  7. Emit the move intent using the normalized direction (same as before): `socket.emit('move', { dx: dirX, dz: dirZ, rotation: playerRotation });`
  8. Remove the `velocityX`/`velocityZ` variables entirely (no longer needed).
- **No other files changed.** Do not modify server code, dungeon generation, or test files.

## Verification: code
