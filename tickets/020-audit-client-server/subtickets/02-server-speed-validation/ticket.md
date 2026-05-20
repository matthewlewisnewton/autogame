# Server Speed Validation

The server currently accepts absolute positions from the client's `move` event with only dungeon-bounds clamping. A malicious client can emit arbitrary positions and effectively teleport anywhere within the dungeon. Add a speed check: compare the client's proposed position against its last known position and reject moves that exceed a maximum distance per tick.

## Acceptance Criteria
- The server computes the distance between the player's last known position and the newly proposed position on each `move` event.
- If the distance exceeds a configured maximum (based on client `MOVE_SPEED` constant × tick duration × a small tolerance factor, e.g., 1.5×), the server rejects the move by ignoring the update and keeping the player at their last known position.
- Legitimate movement at normal speed is never rejected.
- The first `move` after game start (or after respawn) is always accepted to avoid a cold-start rejection.

## Technical Specs
- **Files**: `game/server/index.js` — add distance check inside the existing `socket.on('move', ...)` handler. Compute `Math.hypot(data.x - player.x, data.z - player.z)` and compare against a max distance derived from the client's `MOVE_SPEED` (readable from `game/client/config.js`, currently 12) times the tick interval (50ms) times a tolerance multiplier (1.5). Reject by returning early before updating player position.
- **File**: `game/server/config.js` — add a `MAX_MOVE_DISTANCE_PER_TICK` constant (e.g., `MOVE_SPEED * (1000 / TICK_RATE) * 1.5`) so the value is centralized and easy to tune.
- Do not modify any client files. Do not add network messages for rejected moves.

## Verification: code
