# Normalize Client Movement Input

The client currently emits raw velocity values (`velocityX`, `velocityZ`) as `dx`/`dz` in the `move` event. These can reach ~12 units/s (terminal velocity). The server multiplies them by `MOVE_SPEED` (12) again, producing ~144 units/s of server-side movement and causing constant snap-corrections.

Fix: normalize `dx`/`dz` to a direction vector (magnitude ≤ 1) before emitting, so the server's `MOVE_SPEED` multiplication produces the correct speed.

## Acceptance Criteria
- `updateMyPlayer()` in `main.js` computes the magnitude of `(velocityX, velocityZ)` before emitting.
- When magnitude > 0.001, the emitted `dx`/`dz` are `velocityX / mag` and `velocityZ / mag` (each in range [-1, 1], vector magnitude ≤ 1).
- When magnitude ≤ 0.001, no `move` event is emitted (existing behavior preserved).
- The `rotation` field is still emitted alongside `dx`/`dz`.
- No other files are changed. Do not modify `config.js`, server code, or test files.

## Technical Specs
- **File**: `game/client/main.js` — In `updateMyPlayer()`, replace the current emit line:
  ```
  socket.emit('move', { dx: velocityX, dz: velocityZ, rotation: playerRotation });
  ```
  With normalization logic:
  1. Compute `const mag = Math.hypot(velocityX, velocityZ);`
  2. Emit `socket.emit('move', { dx: velocityX / mag, dz: velocityZ / mag, rotation: playerRotation });`
- **No other files changed.** Do not touch `game/server/`, test files, or config files.

## Verification: code
