# 03 — Enemy and minion symmetric height-aware aim

Apply the same 3D aim and hit logic to non-player projectiles: glacial-thrower ice balls, storm_eagle/thunderbird ranged strikes, null_crawler phase beams, and wyrm breath cones. Enemy and minion wind-up direction locking must aim at the target's full world position, not just XZ bearing.

## Acceptance Criteria

- `lockWindupDirection` (enemy) and `lockMinionWindupDirection` / `lockMinionBreathDirection` store `windupDirY` / `breathDirY` (normalized) toward the target's resolved world Y.
- `spawnIceBall` seeds each ice ball with `y`, `dirY`, and advances it along the 3D ray in `updateEnemyProjectiles`; player contact uses 3D distance (`ball.y` vs `player.y`).
- `null_crawler` phase-beam resolution calls `collectPhaseBeamHits` with `originY` and `dirY` from the minion's locked wind-up direction.
- `storm_eagle` and `thunderbird` ranged strikes validate hits along a 3D ray (or equivalent 3D proximity check) so an elevated enemy at the same `(x, z)` can be damaged when within vertical tolerance.
- `dungeon_drake` / `ancient_wyrm` breath ticks (`applyWyrmBreathTick`) pass vertical aim into `collectConeHits` using the locked `breathDirY`.
- Minion/emitted `CARD_USED` / pending breath events include `direction.y` when the beam/breath is tilted.
- Server tests cover: (a) enemy ice ball hitting a player on a higher `y` at the same `(x, z)`, (b) null_crawler beam hitting an elevated enemy, (c) storm_eagle strike hitting an elevated enemy, (d) wyrm breath cone hitting an elevated enemy.

## Technical Specs

- `game/server/simulation.js`:
  - Update `lockWindupDirection`, `lockMinionWindupDirection`, and `lockMinionBreathDirection` to compute and persist `dirY` via `computeAimDirection3D` / `getEntityWorldY`.
  - `spawnIceBall`: add `y` from `getEntityWorldY(enemy)`, `dirY` from wind-up, advance `ball.y` each tick, 3D hit test vs players.
  - `updateEnemyProjectiles`: 3D movement and collision for ice balls.
  - `updateMinions` branches for `storm_eagle`/`thunderbird`, `null_crawler`, and `updateWyrmMinionAI` / `applyWyrmBreathTick`: pass `originY`/`dirY` into collectors; tilt queued event `direction` objects.
  - Ensure spawned enemies used in these paths have resolvable `y` (set on spawn or via `getEntityWorldY` fallback).
- `game/server/test/height_aware_projectiles.test.js` (extend):
  - Direct simulation tests driving `spawnIceBall` + `updateEnemyProjectiles`, minion wind-up completion, and wyrm breath ticks with Y-offset targets.
  - Reference patterns from `ice_enemy.test.js`, `new_card_pack.test.js` (storm_eagle), and `ancient_wyrm.test.js`.

## Verification: code
