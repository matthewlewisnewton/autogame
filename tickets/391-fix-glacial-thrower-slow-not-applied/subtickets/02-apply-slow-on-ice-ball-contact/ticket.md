# Apply SLOW when glacial-thrower ice ball hits a player

Fix the server ice-ball contact path so every glacial-thrower projectile hit applies SLOW via `applySlow` (ticket 290), not just damage. Reconcile with HEAD: if `updateEnemyProjectiles()` already calls `applySlow`, confirm the sub-ticket 01 tests pass without further logic changes; otherwise wire slow application and ensure in-flight balls carry slow tuning from the thrower's `ENEMY_DEFS` fields.

## Acceptance Criteria

- When `updateEnemyProjectiles()` detects player contact (`dist <= ball.radius + PLAYER_RADIUS`), it calls `applySlow(player, ball.slowDurationMs, ball.slowFactor)` before `damagePlayer`.
- `applySlow` runs even when `damagePlayer` returns early (god-mode, i-frames, barrier dome, absorb shield) — the ball is still consumed and the player is slowed.
- `spawnIceBall(enemy)` copies `iceBallSlowDurationMs` and `iceBallSlowFactor` from the live enemy instance (with the same `??` defaults as today) onto the ball so mid-flight tuning is stable.
- All tests in sub-ticket 01 pass: `pnpm exec vitest run server/test/ice_enemy.test.js server/test/height_aware_projectiles.test.js`.
- `cd game && pnpm test:quick` passes (no regressions in server suite).

## Technical Specs

- **`game/server/simulation.js`**:
  - `spawnIceBall` (~line 3043): verify `slowDurationMs` / `slowFactor` on the ball object come from `enemy.iceBallSlowDurationMs` / `enemy.iceBallSlowFactor` (spread from `ENEMY_DEFS.glacial_thrower` via `spawnEnemy`).
  - `updateEnemyProjectiles` (~line 3075): on player contact, call `applySlow` then `damagePlayer`; do not gate slow on damage succeeding.
  - `ENEMY_DEFS.glacial_thrower` (~line 1141): confirm `iceBallSlowDurationMs` (2500) and `iceBallSlowFactor` (0.5) are present — add only if missing.
- No client changes; slow indicator is already driven by broadcast `slowedUntil` (ticket 290).
- If code already satisfies the above, leave a brief comment in the contact block documenting that slow is intentionally independent of damage (optional, only if it aids future readers).

## Verification: code
