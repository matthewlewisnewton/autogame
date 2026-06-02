# Smoke Bomb — Enemies Lose Detection In Zone

Make an active smoke zone hide players standing inside it from enemy targeting:
while a player is inside any living player's active smoke zone, enemies cannot
acquire that player as a target, and an in-progress wind-up against a player who
has entered a zone is canceled. The zone protects any player inside it (co-op),
not just the caster. The zone is fixed at the cast point.

## Acceptance Criteria

- A helper (e.g. `isPlayerHiddenBySmoke(player, now)`) in
  `game/server/simulation.js` returns true when the player is inside any living
  player's active smoke zone: there exists a player `s` (not dead) with
  `s.smokeBombUntil && now < s.smokeBombUntil` and the candidate's distance to
  `(s.smokeBombX, s.smokeBombZ)` ≤ `s.smokeBombRadius`.
- In `updateEnemies()` target acquisition (the `for (const player of players)`
  nearest-target loop around line 1701), players hidden by smoke are skipped, so
  enemies do not pick them as `nearestTarget`. An enemy standing right next to a
  player who is inside an active smoke zone therefore does NOT enter `windup`
  against that player (it stays `chasing`/`idle` or targets something else).
- The wind-up revalidation (around line 1633, where `resolveWindupTarget` /
  `isEntityInEnemyAttack` are checked before striking) cancels the strike and
  returns the enemy to `chasing` when the wind-up target is a player who is now
  hidden by smoke — so a strike that was already winding up does not land if the
  target ducks into the smoke. (Cancel via the existing
  "target out of range or dead" path; no damage is dealt.)
- Co-op: a player with no smoke zone of their own who stands inside an ally's
  active zone is hidden from enemies exactly as the caster would be.
- When the zone expires (`smokeBombUntil` in the past) or the player steps
  outside the radius, normal targeting resumes (enemies can acquire them again).
- Minion targeting and taunt-minion handling are unaffected; only player
  acquisition is gated by smoke. Smoke does not change enemy movement other than
  the consequence of not having the hidden player as a target.
- Server tests (e.g. extend `game/server/test/smoke_bomb.test.js` from
  sub-ticket 01) cover, by driving `updateEnemies()` with `setGameState`: an
  enemy adjacent to a player inside an active zone does NOT transition to
  `windup` against that player; an enemy already in `windup` against a player
  who is inside the zone cancels the strike (no HP loss, returns to `chasing`);
  an expired zone restores normal targeting (enemy acquires the player); a
  player standing OUTSIDE the radius of an active zone is still targeted.

## Technical Specs

- `game/server/simulation.js`:
  - Add the `isPlayerHiddenBySmoke(player, now)` helper near the other
    zone/geometry helpers; iterate `_gameState.players` for any living player
    with an active `smokeBombUntil` and compare the candidate's distance to that
    zone's `(smokeBombX, smokeBombZ)` against `smokeBombRadius`.
  - In `updateEnemies()` nearest-player loop (around line 1701): `continue` past
    any `player` for which `isPlayerHiddenBySmoke(player, now)` is true (compute
    `now` once per tick / per enemy as convenient).
  - In the wind-up branch (around line 1631-1646): after resolving the target,
    if `enemy.windupTargetType !== 'minion'` and the target player is hidden by
    smoke, take the existing cancel path (`enemy.attackState = 'chasing';
    continue;`) instead of dealing damage.
- Keep the change scoped to enemy targeting in `simulation.js`; do not alter the
  cast handler from sub-ticket 01 or add client rendering.

## Verification: code
