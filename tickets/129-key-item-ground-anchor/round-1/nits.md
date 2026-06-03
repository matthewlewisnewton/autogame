## Wire applyPlayerKnockback into a real player-displacement source

`applyPlayerKnockback` (with ground_anchor immunity baked in) is implemented, exported,
and unit-tested, but no production code path currently calls it — there is no enemy
attack or card effect that knocks a player back today. The anchor's knockback-immunity is
therefore correct but not yet observable in normal play. When a future ticket introduces
any player-displacement effect (e.g. an enemy slam or a hostile knockback card), it should
route through `applyPlayerKnockback` rather than mutating `player.x/z` directly, so the
anchor immunity is honored automatically.

### Acceptance Criteria
- At least one real in-game effect that displaces a player calls `applyPlayerKnockback`.
- That displacement is verifiably ignored while the target player's ground_anchor window
  is active, and applies normally after it expires.
