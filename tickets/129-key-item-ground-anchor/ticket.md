# Key Item: Ground Anchor

**Ground Anchor** (`ground_anchor`) — brief knockback immunity, reduced move speed.

## Difficulty: easy

## Goal

`useKeyItem` sets `anchorUntil` ~1.5s: player cannot be knockbacked; move speed
×0.7 while active.

## Acceptance Criteria

- Cooldown ~6s.
- Hook existing knockback application on players.
- Tests: knockback event ignored during anchor; normal after expiry.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
