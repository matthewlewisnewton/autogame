# Fix Guard Block Facing Convention (Server + Tests)

Align guard block's attacker-angle calculation with the game's established `rotation = atan2(z, x)` convention. Currently `angleFromPlayerTo` uses `atan2(dx, dz)` (angle 0 = +Z), causing `blockingYaw: 0` to protect +Z instead of +X. This makes frontal hits miss the damage-reduction arc during normal gameplay.

## Acceptance Criteria

- `angleFromPlayerTo` in `simulation.js` computes attacker angle as `Math.atan2(dz, dx)` (not `atan2(dx, dz)`).
- `blockingYaw: 0` protects attacks arriving from +X direction (same as `rotation: 0` facing).
- `blockingYaw: Math.PI / 2` protects attacks from +Z direction.
- All existing guard block tests in `guard_block.test.js` and `server.test.js` are updated to the correct convention and **pass**.
- Frontal hit (within ±75° of `blockingYaw`) still receives 70% damage reduction.
- Rear hit (>75° from `blockingYaw`) still deals full damage.
- Dodge i-frame priority over block is unchanged.

## Technical Specs

**Files to change:**
- `game/server/simulation.js` — change `angleFromPlayerTo` from `Math.atan2(attackerPos.x - player.x, attackerPos.z - player.z)` to `Math.atan2(attackerPos.z - player.z, attackerPos.x - player.x)`
- `game/server/test/guard_block.test.js` — update `createEnemyAtAngle` helper: swap `Math.sin(angle)` → `Math.cos(angle)` for x-offset and `Math.cos(angle)` → `Math.sin(angle)` for z-offset; update comments to reflect `atan2(dz, dx)` convention; verify `blockingYaw: 0` protects +X
- `game/server/test/server.test.js` — update guard block test cases: enemy at `x: 3, z: 0` should be frontal for `blockingYaw: 0`; enemy at `x: -3, z: 0` should be rear; update edge-of-arc positions to use `cos`/`sin` instead of `sin`/`cos`

## Verification: code
