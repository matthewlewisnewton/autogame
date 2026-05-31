# Key Item: Purge Charm

**Purge Charm** (`purge_charm`) — remove one debuff from self, or grant 1-hit shield.

## Difficulty: medium

## Goal

`useKeyItem` clears the oldest active debuff on player (slow, burn, etc.); if none,
grant `shieldHitsRemaining: 1` absorbing next damage.

## Acceptance Criteria

- Cooldown ~7s.
- If no debuff system exists yet, implement minimal `player.debuffs[]` with at
  least one test debuff path OR shield-only fallback documented.
- Tests: debuff cleared; no debuff → shield absorbs one hit.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
