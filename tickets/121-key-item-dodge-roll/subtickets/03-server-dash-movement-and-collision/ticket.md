# Server: dodge roll dash movement with wall collision

## Description

Implement the actual dash movement for `dodge_roll` in the `useKeyItem` socket handler. On success, the player is moved quickly in their current input direction (or last facing yaw if stationary) for a fixed distance, respecting wall collisions and floor slopes. The dash also sets `invulnerableUntil` for one simulation tick.

## Acceptance Criteria

- On successful `dodge_roll` use (not on cooldown, in `playing` phase):
  - Direction is resolved from `player.inputDx/inputDz`; if magnitude is near-zero, fall back to `player.rotation` yaw (`dx = sin(rotation)`, `dz = cos(rotation)`).
  - Player is moved at **`MOVE_SPEED * 3`** effective rate over `rollDistanceMs` (200ms from `KEY_ITEM_DEFS`), producing a total dash distance of `MOVE_SPEED * 3 * (rollDistanceMs / 1000)`.
  - Movement uses existing `tryPlayerMove()` or `tryDisplacement()` with axis-separated wall sliding — player stops at walls, no clipping.
  - After movement, `player.y` is set via `sampleFloorY(layout, player.x, player.z)` (falls back to `DEFAULT_FLOOR_Y` if sampling fails).
  - `player.invulnerableUntil` is set to `now + invincibleDurationMs` (300ms from `KEY_ITEM_DEFS`), granting i-frames.
  - `player.keyItemCooldownUntil` is set to `now + cooldownMs` (800ms from `KEY_ITEM_DEFS`).
  - `stateSnapshot()` is broadcast to all lobby clients so other players see the position update.
- If the player has no valid input direction and no rotation, the dash still fires using a default forward direction (no crash).
- Dash does **not** occur if `tryPlayerMove` results in zero displacement (player is fully enclosed — edge case, no error).
- Other key items (`keyItemId !== 'dodge_roll'`) continue to return `not_implemented` (unchanged).

## Technical Specs

- **File**: `game/server/index.js`
  - Replace the dodge_roll stub in `useKeyItem` handler (line ~2438–2444) with:
    ```js
    // dodge_roll implementation
    if (keyItemId === 'dodge_roll') {
      const def = getKeyItemDef('dodge_roll');
      const now = Date.now();

      // Resolve direction from input or fallback to facing
      let dx = player.inputDx || 0;
      let dz = player.inputDz || 0;
      const mag = Math.hypot(dx, dz);
      if (mag < 1e-8) {
        // No active input — use player rotation yaw
        const yaw = player.rotation || 0;
        dx = Math.sin(yaw);
        dz = Math.cos(yaw);
      } else {
        dx /= mag;
        dz /= mag;
      }

      // Dash distance: MOVE_SPEED * 3 * (rollDistanceMs / 1000)
      const dashDistance = MOVE_SPEED * 3 * ((def.rollDistanceMs || 200) / 1000);
      const colliders = getWallColliders();
      const result = tryPlayerMove(player.x, player.z, dx, dz, dashDistance, colliders);

      player.x = result.x;
      player.z = result.z;

      // Follow floor slope
      const layout = gameState.run ? gameState.run.layout : null;
      if (layout) {
        const floorY = sampleFloorY(layout, player.x, player.z);
        player.y = Number.isFinite(floorY) ? floorY : DEFAULT_FLOOR_Y;
      }

      // Set invulnerability and cooldown
      player.invulnerableUntil = now + (def.invincibleDurationMs || 300);
      player.keyItemCooldownUntil = now + (def.cooldownMs || 800);
      player.persistenceDirty = true;

      socket.emit('keyItemUsed', { ok: true, keyItemId, cooldownUntil: player.keyItemCooldownUntil, x: player.x, y: player.y, z: player.z });
      io.to(lobby.id).emit('stateUpdate', stateSnapshot());
      return;
    }
    ```

  - Import needed helpers at top of file if not already imported: `tryPlayerMove`, `getWallColliders`, `sampleFloorY`, `DEFAULT_FLOOR_Y` (check `simulation.js` and `progression.js` exports).

- **File**: `game/server/simulation.js` — ensure `tryPlayerMove`, `getWallColliders`, `sampleFloorY` are exported if not already.

- **File**: `game/server/progression.js` — ensure `sampleFloorY` and `DEFAULT_FLOOR_Y` are available (may already be imported from `simulation.js`).

## Verification: code
