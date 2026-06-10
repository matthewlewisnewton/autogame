# Server test: glacial-thrower ice ball applies SLOW on player hit

Add focused server vitest coverage that a glacial-thrower ice-ball contact applies the SLOW status (ticket 290) to the player, matching the ICE playthrough probe `glacialThrowerSlowApplied`. Extend or add cases in the existing ice-enemy test suite so the real spawn → wind-up → projectile → contact path is locked in, including cases where damage is skipped but slow must still land.

## Acceptance Criteria

- A test deploys a `spawnEnemy(…, 'glacial_thrower')` thrower, drives `updateEnemies()` through wind-up completion so an ice ball is spawned from live enemy stats (not a hand-built `makeThrower`), then ticks `updateEnemyProjectiles()` until the ball reaches the player.
- After contact, the player is `isSlowed(player) === true`, `player.slowedUntil` is in the future, and `player.slowFactor` matches `ENEMY_DEFS.glacial_thrower.iceBallSlowFactor`.
- A separate test (or case) places the player in `debugGodmode: true` (or `invulnerableUntil` in the future): HP unchanged after hit, but `isSlowed(player) === true` — slow is independent of damage resolution.
- The height-aware glacial-thrower case in `height_aware_projectiles.test.js` asserts SLOW in addition to HP loss when the ball hits an elevated player on the same `(x, z)`.
- `cd game && pnpm exec vitest run server/test/ice_enemy.test.js server/test/height_aware_projectiles.test.js` passes.

## Technical Specs

- **`game/server/test/ice_enemy.test.js`** — add `spawnEnemy` import from `../progression.js`; new describe block or `it` for the full wind-up → projectile → slow path using a spawned thrower (mirror fake-timer setup from existing tests).
- **`game/server/test/height_aware_projectiles.test.js`** — in the `glacial_thrower` `it('ice ball hits a player elevated on the same (x, z)')` case, import `isSlowed` and assert slow fields after `updateEnemyProjectiles()` (damage assertion already present).
- Reference helpers: `isSlowed`, `applySlow` patterns from `game/server/test/slow_status.test.js`; `ENEMY_DEFS.glacial_thrower` for expected `iceBallSlowDurationMs` / `iceBallSlowFactor`.
- Do **not** change `game/server/simulation.js` in this sub-ticket.

## Verification: code
