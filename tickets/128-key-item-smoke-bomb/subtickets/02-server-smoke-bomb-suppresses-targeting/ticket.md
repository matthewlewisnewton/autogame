# Smoke Bomb — enemies lose targeting inside the fog

While a living player stands inside any active smoke zone (created in
sub-ticket 01), enemies cannot detect/target that player: the player is skipped
in enemy nearest-target selection, and any in-progress enemy wind-up aimed at a
player who is now inside smoke is cancelled (the attack misses). This implements
the "targeting cleared while in zone" rule from the top-level ticket.

## Acceptance Criteria

- A helper exists (e.g. exported `isInSmokeZone(x, z)` in `simulation.js`) that
  returns `true` when point `(x, z)` is within `smokeBombRadius` of ANY living
  player whose `smokeBombUntil` is still in the future, and `false` otherwise.
- In the enemy AI target-selection loop, a player standing inside an active
  smoke zone is NOT selected as `nearestTarget` (the player is effectively
  undetectable while smoked). Minions and non-smoked players are still targeted
  normally.
- An enemy that is mid-windup (`attackState === 'windup'`, `windupTargetType ===
  'player'`) against a player who has entered an active smoke zone cancels the
  attack (deals no damage, returns to `chasing`/`idle`) instead of landing the hit.
- The suppression is purely positional and time-bounded: once the smoke zone
  expires (`now >= smokeBombUntil`) OR the player steps outside
  `smokeBombRadius`, the enemy can target/attack that player again on the next
  tick.
- A caster's smoke zone protects any player standing in it (co-op), not only the
  caster.
- Tests in `game/server/test/` cover: (a) an enemy within detection range of a
  single player who is inside an active smoke zone does NOT acquire that player
  as a target / does NOT enter windup against them; (b) after the smoke zone is
  expired (or the player moved outside the radius), the same enemy DOES acquire
  the player; (c) `isInSmokeZone` returns true inside the radius of an active
  zone and false when expired or out of radius.

## Technical Specs

- `game/server/simulation.js`:
  - Add and export `isInSmokeZone(x, z)` that iterates `_gameState.players`,
    skipping dead players, and returns `true` if `(x, z)` is within
    `(p.smokeBombRadius || 0)` of `(p.smokeBombX, p.smokeBombZ)` while
    `Date.now() < p.smokeBombUntil`.
  - In the enemy AI tick (~line 1701), inside the `for (const player of players)`
    nearest-target loop, `continue` past any player for whom
    `isInSmokeZone(player.x, player.z)` is true so they are never chosen as
    `nearestTarget`.
  - In the windup-resolution block (~line 1635, where a player windup target is
    resolved and `damagePlayer(enemy.windupTargetId, ...)` is called), before
    dealing damage check the target player's position with `isInSmokeZone`; if
    true, skip the damage, set `enemy.attackState = 'chasing'`, and `continue`
    (the attack misses into the fog).

## Verification: code
