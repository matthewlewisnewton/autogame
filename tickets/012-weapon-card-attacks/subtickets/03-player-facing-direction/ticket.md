# Player Facing Direction

Fix the hardcoded `rotation: 0` in the client's `move` emit so that weapon attacks fire in the direction the player is actually moving/facing, instead of always world +X.

## Acceptance Criteria
- The client derives a facing angle from the current movement velocity vector (`Math.atan2(velocityZ, velocityX)`) and sends it as `rotation` in every `move` socket event
- When the player is stationary (both velocity components near zero), the last non-zero facing angle is preserved and sent (not reset to 0)
- The server stores this rotation value on the player object (`player.rotation`)
- The server's `useCard` handler uses the stored `player.rotation` to compute the attack direction vector — so the hit cone and broadcast `direction` reflect the player's actual facing
- Weapon attack projectiles travel in the direction the player was last moving toward, not a fixed +X axis

## Technical Specs
- **Files**: `game/client/main.js`
- Add a `playerRotation` variable (default `0`) in `game/client/main.js`
- In `updateMyPlayer`, after computing `velocityX` / `velocityZ`, update `playerRotation` whenever either component exceeds a small threshold (e.g., `0.01`): `playerRotation = Math.atan2(velocityZ, velocityX)`
- Replace the hardcoded `rotation: 0` in the `socket.emit('move', ...)` call with `rotation: playerRotation`
- **Files**: `game/server/index.js` — no changes needed; the `move` handler already writes `player.rotation = data.rotation`, and the `useCard` handler already uses `player.rotation` for direction

## Verification: code
