# Key Item: Echo Strike

**Echo Strike** (`echo_strike`) — next weapon hit repeats at 50% damage shortly after.

## Difficulty: medium

## Goal

`useKeyItem` sets `echoStrikePending: true`; next weapon card damage also applies
a delayed second hit at 50% to the same target.

## Acceptance Criteria

- Cooldown ~10s.
- Only weapon-type cards trigger echo; spells/summons do not.
- Tests: one weapon use deals two damage packets; echo consumed after one proc.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
