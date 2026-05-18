# Clamp Player Position to World Bounds

After validating a `move` payload, clamp `x` and `z` coordinates to the world boundary of -25 to 25 before writing them to game state.

## Acceptance Criteria
- `x` values outside the range [-25, 25] are clamped to -25 or 25
- `z` values outside the range [-25, 25] are clamped to -25 or 25
- `y` and `rotation` are **not** clamped (only validated for finiteness by sub-ticket 01)
- Clamped values are written to `gameState.players[socket.id]` — the original `data` is never applied directly

## Technical Specs
- **File to modify**: `game/server/index.js`
- **Key change**: In the `move` handler, after the validation guard, apply clamping before assignment:

  ```js
  const clampedX = Math.max(-25, Math.min(25, data.x));
  const clampedZ = Math.max(-25, Math.min(25, data.z));
  gameState.players[socket.id].x = clampedX;
  gameState.players[socket.id].y = data.y;
  gameState.players[socket.id].z = clampedZ;
  gameState.players[socket.id].rotation = data.rotation;
  ```

- This sub-ticket depends on **01-move-payload-validation** (validation must run first).

## Verification: code
