## Per-Criterion Findings

### Runtime health
PASS. The captured run loaded cleanly: `metrics.json` has `"ok": true`, gameplay reached `phase: "playing"` with a canvas and connected socket, and `pageerrors` is empty. `console.log` contains only Vite connection lines plus 409 resource noise, with no `pageerror` or `[fatal]` entries from game code.

### Cooldown ~3-4s
PASS. `guard_block` is configured with a 3500 ms cooldown in `game/server/progression.js`, the server applies `keyItemCooldownUntil` when used, and tests cover immediate reuse returning `on_cooldown`.

### Damage pipeline coverage
FAIL. The implementation routes enemy wind-up hits through `damagePlayer()` with `attackerEnemyId`, so the correct architectural hook is present. However, the facing calculation is incompatible with the rest of the game rotation convention. Client movement and card attacks use `rotation = atan2(z, x)` and server attacks convert that with `dirX = cos(rotation)`, `dirZ = sin(rotation)`, so `rotation: 0` means facing +X. Guard block computes attacker angle with `atan2(dx, dz)` and compares it directly to `blockingYaw`, which makes `rotation: 0` protect +Z instead. The tests encode that wrong convention, so a real player blocking while facing an enemy on +X will not receive frontal damage reduction, while an enemy off to +Z can be incorrectly treated as frontal.

### Dodge priority / stacking
PASS. `damagePlayer()` checks `invulnerableUntil` before block reduction, so dodge i-frames win and block reduction is not stacked onto invulnerable damage. Tests cover this priority.

### Client shield pose or VFX on facing direction
FAIL. The shield VFX has the same axis mismatch as the server block arc. It derives `yaw` from the player mesh and positions the shield with `-sin(yaw), -cos(yaw)`, so a player whose gameplay rotation is facing +X has the shield drawn along Z instead of the actual facing direction. This means both the visual feedback and the server-side protected arc disagree with the game's existing attack/movement facing.

### Tests
FAIL. Tests cover cooldown, frontal/rear damage, expiration, and invulnerability priority, but they assert the wrong facing convention (`blockingYaw: 0` as +Z). They therefore pass while missing the real gameplay mismatch with card/movement rotation.

### Design and requirements consistency
PARTIAL. The feature fits the combat/key-item direction and does not regress basic rendering, networking, multiplayer visualization, or movement synchronization. The captured smoke run confirms the foundation still starts and runs. The facing mismatch prevents the ticket's intended combat behavior from being robustly satisfied.

### Debug scenario review
PASS. The added `guard-block-ready` scenario is listed in the server debug scenario set and remains behind the existing debug-scenario path. It only prepares a QA state by equipping `guard_block`, lowering HP, and clearing cooldown; the equivalent state remains reachable through normal gameplay by equipping the key item in the lobby, deploying, and using it in the dungeon. It does not appear to bypass server-side `useKeyItem` validation for the actual block activation.

## Remaining gaps

1. Guard Block's protected arc and shield VFX are rotated away from the game's actual facing convention. A real player using normal movement/card-facing rotation can fail to block frontal hits and see the shield drawn in the wrong direction.
   Files: `game/server/simulation.js`, `game/server/index.js`, `game/client/renderer.js`, `game/server/test/guard_block.test.js`, `game/server/test/server.test.js`.
   Fix: align guard block with the existing `rotation = atan2(z, x)` convention: compute attacker angles as `atan2(dz, dx)`, compare against `blockingYaw`, place the shield with `cos(yaw), sin(yaw)` in front of the player, and update tests so `rotation/blockingYaw: 0` protects +X while `Math.PI / 2` protects +Z.

VERDICT: FAIL
