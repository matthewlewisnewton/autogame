# Client Prediction and Server Reconciliation

The client currently moves its local player position every frame and emits `move` events with the local position. The server broadcasts `stateUpdate` with authoritative positions every tick, but the client never compares or reconciles its local position against the server's corrections. Add a reconciliation step: after receiving `stateUpdate`, if the server's position for the local player differs from the client's predicted position by more than a threshold, snap the local position back to the server's truth.

## Acceptance Criteria
- After each `stateUpdate`, the client compares its local `myX`/`myZ` against the server's authoritative position for `gameState.players[myId]`.
- If the difference exceeds a small threshold (e.g., 0.5 units), the client snaps `myX`/`myZ` to the server's position.
- Normal movement with no server rejection is unaffected — no visible snapping during normal play.
- The reconciliation only runs when `gamePhase` is `playing` and the player is not dead.

## Technical Specs
- **File**: `game/client/main.js` — in the `socket.on('stateUpdate', ...)` handler, after updating `gameState`, add a reconciliation block: read `gameState.players[myId].x` and `.z`, compare against local `myX`/`myZ` using `Math.hypot()`. If distance > 0.5, set `myX` and `myZ` to the server values. Place this after the existing state sync logic.
- Do not modify any server files. Do not add new socket events. Do not change the movement input loop.

## Verification: code
