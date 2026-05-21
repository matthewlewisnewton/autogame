# Fix Movement Unit Mismatch — Normalized Input Axes

The client sends raw velocity values (`velocityX`, `velocityZ`) as `dx`/`dz` in the `move` event. These values are already in units/second (accelerated by `acceleration`, damped by `friction`, terminal velocity ~12). The server treats them as direction-like inputs and multiplies by `MOVE_SPEED` (12) again — producing ~144 units/s of server-side movement. This systematic mismatch causes the server's authoritative position to diverge from the client's prediction, triggering constant snap-corrections instead of robust client-side prediction.

Normalize the movement intent so that both client and server agree on the same speed/integrator.

## Acceptance Criteria
- The client sends normalized movement axes (magnitude ≤ 1) as `dx`/`dz` in the `move` event, not raw velocity.
- The server multiplies the normalized axes by `MOVE_SPEED * elapsed` to compute displacement — producing movement in units/second that matches the client's terminal velocity.
- The client's local prediction (acceleration/friction model) and the server's authoritative integration produce positions that stay within the reconciliation drift threshold (0.5 units) during sustained WASD movement.
- An integration test or probe verifies that after several seconds of sustained directional input, the client's predicted position and the server's authoritative position remain close (drift < 1.0 unit).

## Technical Specs
- **File**: `game/client/main.js` — In `updateMyPlayer()`, normalize `velocityX`/`velocityZ` before emitting:
  1. Compute the magnitude: `const mag = Math.hypot(velocityX, velocityZ);`
  2. If `mag > 0.001`, emit normalized axes: `socket.emit('move', { dx: velocityX / mag, dz: velocityZ / mag, rotation: playerRotation });`
  3. If `mag <= 0.001`, do not emit (already the case — keep this).
  This sends direction-only intent; the server applies `MOVE_SPEED` to get the actual speed.
- **File**: `game/server/index.js` — No change needed to the server's `move` handler. It already does `data.dx * MOVE_SPEED * cappedElapsed`, which is correct when `dx`/`dz` are normalized (magnitude ≤ 1). The existing distance cap (`MOVE_SPEED * cappedElapsed * MOVE_SPEED_TOLERANCE`) also remains correct.
- **File**: `game/server/test/integration.test.js` — Add a test that:
  1. Connects a client, emits sustained `move` events with normalized axes (`dx: 1, dz: 0`) for ~1 second of simulated time.
  2. Reads the server's authoritative position from `stateUpdate`.
  3. Asserts the displacement is approximately `MOVE_SPEED * elapsedSeconds` (within tolerance), confirming the server applies `MOVE_SPEED` to normalized input.
- **No other files changed.** Do not modify `game/client/config.js`, `game/server/config.js`, enemy AI, or dungeon generation.

## Verification: code
