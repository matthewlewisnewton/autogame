# Client: Warded shield indicator

Show warded (and any shielded) enemy shield remaining on the client so players can
see when the absorb layer is active and when it breaks, using `shieldHp` /
`maxShieldHp` from the game-state snapshot.

## Acceptance Criteria

- While `enemy.shieldHp > 0`, a shield indicator is visible above the enemy (e.g. a
  thin cyan bar above the HP bar, or a ring overlay) scaled to
  `shieldHp / maxShieldHp`.
- When `shieldHp` reaches 0, the indicator is removed/hidden; the HP bar behavior
  is unchanged.
- The indicator updates each frame as `shieldHp` drops from combat (requires
  sub-ticket 02 on the server).
- Enemies without a shield (`shieldHp` absent or 0) show no shield indicator.
- Renderer tests or a focused unit test assert create/update/dispose of the shield
  mesh; existing tests pass.

## Technical Specs

- `game/client/renderer.js`:
  - Add `enemyShieldBars` map (parallel to `enemyHealthBars`).
  - `ensureEnemyShieldBar` / `updateEnemyShieldBarMesh(enemyId, enemy)` — create a
    slim box or ring at `halfHeight + 0.65`, cyan material (`0x22d3ee`), scale.x =
    `shieldHp / maxShieldHp`; dispose on enemy removal via existing
    `disposeStaleMeshes` pass.
  - Call from the enemy sync loop after health-bar sync (~4104).
- `game/client/test/` (new or extend renderer tests): verify bar appears when
  `shieldHp > 0`, scales down after a mocked state update, and disposes when shield
  hits 0 or enemy id leaves the set.
- `game/server/debugScenarios.js`: ensure `warded-enemy` scenario sets
  `shieldHp`/`maxShieldHp` so the indicator is visible without dealing damage first.
- Depends on sub-tickets 01–03.

## Verification: code
