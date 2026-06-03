# Cleanup nits from 129-key-item-ground-anchor

> **Staleness note.** This follow-up ticket was written against commit
> `fab8424` (2026-06-03). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `129-key-item-ground-anchor`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

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
