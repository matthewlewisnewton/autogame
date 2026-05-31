# Key Item: Rally Cry

**Rally Cry** (`rally_cry`) — party move speed buff in 8m for 4s (no heal).

## Difficulty: easy

## Goal

`useKeyItem` applies `rallyUntil` + `rallySpeedMultiplier` to all players in
radius including caster.

## Acceptance Criteria

- Cooldown ~10s.
- ~+10% move speed (stacking rule: no stack with itself).
- Tests: two players in radius faster move delta; expires after 4s.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
