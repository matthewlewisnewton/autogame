# Tests: dodge roll unit + integration tests and controls documentation

## Description

Add unit and integration tests for the dodge roll key item, covering cooldown gating, invulnerability, dash movement, and wall collision. Also update `game/docs/controls.md` to document dodge roll behavior and cooldown.

## Acceptance Criteria

### Unit tests

- **Cooldown gate**: Creating a player with `keyItemCooldownUntil` in the future causes the `useKeyItem` handler to return `{ ok: false, reason: 'on_cooldown' }` without modifying player position or consuming another cooldown.
- **Invulnerability blocks damage**: Calling `damagePlayer()` on a player with `invulnerableUntil` in the future returns `null` and leaves `player.hp` unchanged. After `invulnerableUntil` expires, damage applies normally.
- **Dash direction from input**: Player with active `inputDx/inputDz` dashes in that direction. Final position is approximately `start + normalize(input) * dashDistance`.
- **Dash direction fallback to rotation**: Player with zero input dashes in the direction of `player.rotation` (yaw). `dx = sin(rotation)`, `dz = cos(rotation)`.
- **Dash respects walls**: Player dashes toward a wall and stops at the wall boundary (within `PLAYER_RADIUS` tolerance), not clipping through.
- **Cooldown set on success**: After a successful dodge, `player.keyItemCooldownUntil === now + cooldownMs` (800ms from `KEY_ITEM_DEFS`).

### Integration tests

- **Socket flow**: Client emits `useKeyItem` with `{ keyItemId: 'dodge_roll' }` → server moves player, sets cooldown, broadcasts `stateUpdate`. Second emit within cooldown returns `on_cooldown`.
- **State snapshot**: After dodge, `stateSnapshot` includes updated player position and `keyItemCooldownRemaining > 0`.

### Documentation

- `game/docs/controls.md` has a "Dodge Roll" subsection under Key Item describing:
  - What it does (fast burst in movement direction with brief invulnerability)
  - Cooldown duration (800ms from `KEY_ITEM_DEFS`)
  - Invulnerability duration (300ms / one simulation tick)
  - Direction resolution (input vector, fallback to facing)

### No regression

- All existing tests continue to pass (`pnpm test` from `game/`).

## Technical Specs

- **File**: `game/server/test/dodge_roll.test.js` (new)
  - Test class `TestDodgeRollCooldown`:
    - Mock a player with `keyItemCooldownUntil = Date.now() + 500`, call the useKeyItem logic, assert `{ ok: false, reason: 'on_cooldown' }`.
  - Test class `TestInvulnerabilityBlocksDamage`:
    - Set `player.invulnerableUntil = Date.now() + 300`, call `damagePlayer(playerId, 50)`, assert `player.hp` unchanged and return is `null`.
    - Advance time past `invulnerableUntil`, call `damagePlayer`, assert damage applies.
  - Test class `TestDashDirection`:
    - Set `player.inputDx = 1, inputDz = 0`, trigger dodge, assert `player.x` increased by approximately `MOVE_SPEED * 3 * 0.2`.
    - Set `player.inputDx = 0, inputDz = 0, rotation = Math.PI / 2`, trigger dodge, assert movement in rotation direction.
  - Test class `TestDashWallCollision`:
    - Place a wall collider in the dash path, trigger dodge, assert player stops at wall boundary.

- **File**: `game/server/test/integration.test.js`
  - Add test `useKeyItem dodge_roll moves player and sets cooldown`:
    - Start game, join lobby, deploy to dungeon.
    - Emit `useKeyItem` with `{ keyItemId: 'dodge_roll' }`.
    - Assert player position changed, `keyItemCooldownUntil` is set.
    - Emit `useKeyItem` again within 800ms, assert `on_cooldown` response.

- **File**: `game/docs/controls.md`
  - Add under the "Key Item" section:
    ```markdown
    ### Dodge Roll

    The **Dodge Roll** is the default equipped key item. When activated, your character performs a fast burst in the current movement direction (or facing direction if stationary) with brief invulnerability.

    - **Cooldown:** 800ms
    - **Invulnerability:** ~300ms (one simulation tick) — you cannot take damage during this window
    - **Direction:** Uses your current WASD/gamepad stick input; if stationary, uses your character's facing direction
    - **Collision:** The dash stops at walls — you cannot clip through dungeon geometry
    ```

## Verification: code
