# Movement Intent Protocol with Server-Side Integration

The client currently emits absolute positions (`{x, y, z, rotation}`) and the server accepts them if they pass a per-message delta check. A modified client can spam sub-threshold moves to exceed intended speed, or a legitimate client under network batching can be unfairly rejected. Change the movement protocol so the client sends **input intents** (direction + rotation) and the server integrates the authoritative position using elapsed time and speed limits.

## Acceptance Criteria
- The client emits a `move` event containing `{ dx, dz, rotation }` (direction intent) instead of absolute `{ x, y, z, rotation }`.
- The server stores `lastMoveTime` per player and computes elapsed time since the last accepted move to enforce `MOVE_SPEED` (units/second) rather than a per-packet distance cap.
- The server integrates the new position: `newX = player.x + dx * elapsed`, `newZ = player.z + dz * elapsed`, clamped to `MOVE_SPEED * elapsed * MOVE_SPEED_TOLERANCE`.
- The server still applies wall collision and bounds clamping to the integrated position before accepting it.
- The server broadcasts the authoritative position to all clients via the existing `stateUpdate` / `stateSnapshot` mechanism.
- The client's existing drift-reconciliation snap (comparing predicted vs. server position on `stateUpdate`) continues to correct visual desync.

## Technical Specs
- **File**: `game/server/index.js` — In the `socket.on('move', ...)` handler, replace the current delta check (`Math.hypot(data.x - player.x, data.z - player.z) > MAX_MOVE_DISTANCE_PER_TICK`) with elapsed-time speed enforcement. Add `player.lastMoveTime` (initialized on connection and on spawn). Compute `elapsed = (Date.now() - player.lastMoveTime) / 1000`. Integrate: `moveX = data.dx * MOVE_SPEED * elapsed`, `moveZ = data.dz * MOVE_SPEED * elapsed`, cap total distance to `MOVE_SPEED * elapsed * MOVE_SPEED_TOLERANCE`. Apply `clampToDungeon` and `checkWallCollision` to the result. Set `player.x`, `player.y = 0.5`, `player.z`, `player.rotation = data.rotation`, `player.lastMoveTime = Date.now()`. Remove `firstMoveAfterSpawn` flag (no longer needed — elapsed time from lastMoveTime naturally handles first move after spawn).
- **File**: `game/client/main.js` — In the movement emit block (around line 1506), change `socket.emit('move', { x: myX, y: 0.5, z: myZ, rotation: playerRotation })` to compute `dx = velocityX`, `dz = velocityZ` and emit `socket.emit('move', { dx, dz, rotation: playerRotation })`. Do not modify the WASD input handling, `clampDelta`, or client-side position prediction — only change what's emitted.
- **File**: `game/server/config.js` — No changes needed; `MOVE_SPEED`, `MOVE_SPEED_TOLERANCE`, and `MAX_MOVE_DISTANCE_PER_TICK` already exist.
- **No other files changed.** Do not modify tests, dungeon generation, or enemy AI.

## Verification: code
