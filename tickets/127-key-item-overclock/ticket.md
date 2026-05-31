# Key Item: Overclock

**Overclock** (`overclock`) — next 2 card uses ignore slot cooldown (still pay MS).

## Difficulty: medium

## Goal

`useKeyItem` sets `overclockChargesRemaining: 2` on player; next two successful
`useCard` skip `slotCooldowns` assignment but still consume MS and card logic.

## Acceptance Criteria

- Cooldown ~12–15s on the key item itself.
- Charges decrement per card use; expire on run end.
- Does not bypass MS cost or deck empty checks.
- Tests: use overclock, two rapid card plays without slot CD; third respects CD.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
