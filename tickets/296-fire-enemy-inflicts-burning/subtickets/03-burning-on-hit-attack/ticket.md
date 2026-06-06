# Ember Wraith burning-on-hit attack

When an `ember_wraith` (or any enemy def with `burnDurationMs > 0`) resolves a successful player-directed windup strike, call `applyBurning` on the target player so they take per-tick burn damage (ticket 291) in addition to the immediate attack damage. Add focused server tests; player burning animation is already client-driven from broadcast `burningUntil`.

## Acceptance Criteria

- On windup strike resolution in `updateEnemies`, after `damagePlayer` succeeds for a living player target, if the attacking enemy's `burnDurationMs > 0`, the server calls `applyBurning(player, enemy.burnDurationMs)`.
- A hit that is cancelled (target out of range, concealed by smoke, or dead) does **not** apply burning.
- Strikes from enemies without `burnDurationMs` (grunt, skirmisher, etc.) do **not** apply burning to players.
- After an `ember_wraith` hit, `isBurning(player)` is true and `player.burningUntil` is `now + burnDurationMs` (respecting extend-not-shorten semantics from `applyBurning`).
- Advancing time and calling `updateBurning()` deals tick damage to the ignited player (BURN tick interval + extra fire damage per ticket 291).
- Vitest passes.

## Technical Specs

- `game/server/simulation.js`:
  - In the `attackState === 'windup'` strike branch (~L2470–2482), after `damagePlayer(...)`, resolve the player object and, when `enemy.burnDurationMs > 0`, call `applyBurning(player, enemy.burnDurationMs)`. Use the generic `burnDurationMs` field so the hook is reusable; `ember_wraith` is the first consumer.
  - Ensure `spawnEnemy` spreads `burnDurationMs` from `ENEMY_DEFS` onto instances (should follow existing def-spread pattern from sub-ticket 01).
- `game/server/debugScenarios.js` (optional but helpful):
  - Add a `ember-wraith` debug scenario: one `ember_wraith` near the player start for harness inspection.
- `game/server/test/ember_wraith_burning.test.js` (new, preferred):
  - Use `resetGameState`, `vi.useFakeTimers`, `spawnEnemy`, `updateEnemies`, `applyBurning`, `isBurning`, `updateBurning` patterns from `burning_status.test.js`, `burning_tick_damage.test.js`, and `field_medic.test.js`.
  - Cases: successful cone hit ignites player; miss / out-of-range windup does not; grunt hit does not ignite; tick damage accrues over 2+ burn intervals then stops after expiry.
- Do **not** add client mesh or lock-on UI changes in this sub-ticket.

## Verification: code
