# Slow reduces player move speed and enemy chase speed

Wire the SLOW status (from sub-ticket 01) into actual movement: a slowed player
moves at the reduced `slowFactor` multiplier and a slowed enemy chases at the
reduced multiplier, both returning to normal speed when the effect expires. Also
expose `slowedUntil`/`slowFactor` to clients so the indicator sub-ticket can read
it.

## Acceptance Criteria
- While `isSlowed(player)` is true, the per-tick player movement step is
  multiplied by `player.slowFactor` (stacking multiplicatively with existing
  modifiers like guard_block / rally_cry / ground_anchor, not replacing them).
- While `isSlowed(enemy)` is true, the enemy chase speed is multiplied by
  `enemy.slowFactor` (stacking with the existing frenzied multiplier). A frozen
  enemy still does not move (freeze takes precedence / is unaffected).
- When `slowedUntil` expires, both players and enemies return to their normal
  (unmultiplied-by-slow) speed on the next tick.
- The player hot snapshot exposes `slowedUntil` and `slowFactor` so the client
  can render an indicator. Enemy snapshots already include these fields (enemies
  are serialized raw), so verify they are present in the broadcast enemy objects.
- New vitest cases assert: a slowed player moves a shorter distance per tick than
  an un-slowed player and returns to full distance after expiry; a slowed enemy
  covers less chase distance per tick than an un-slowed enemy and returns to
  normal after expiry; re-application keeps the entity slowed past the original
  expiry.

## Technical Specs
- `game/server/simulation.js`:
  - In `applyPlayerMovement` (around lines 480-486, where `playerStep` is
    adjusted for `blockingUntil`/`rallyUntil`/`anchorUntil`), add a slow factor:
    `if (isSlowed(player)) playerStep *= (player.slowFactor || 1);`.
  - In the enemy AI loop (around lines 2003-2009, where `chaseSpeed` is computed
    from `chaseSpeedMult`), multiply by the slow factor when
    `isSlowed(enemy)` — e.g. `const slowMult = isSlowed(enemy) ? (enemy.slowFactor || 1) : 1;`
    applied to `chaseSpeed`. Keep the existing `isEnemyFrozen(enemy)` early
    `continue` so frozen enemies remain fully stopped.
- `game/server/progression.js`:
  - In `buildPlayerHotSnapshot` (around line 2910), add
    `slowedUntil: p.slowedUntil || 0` and `slowFactor: p.slowFactor || 1`.
  - Enemies are serialized via `buildWorldSnapshot` (`enemies: _gameState.enemies`)
    so no change is needed there — confirm `slowedUntil`/`slowFactor` flow through.
- Add tests (extend `game/server/test/slow_status.test.js` or the existing
  movement/enemy AI tests) using `applySlow` + tick stepping to compare distances.

## Verification: code
