# Key Item: Guard Block

**Guard / Block** (`guard_block`) — short frontal damage reduction stance.

## Difficulty: medium

## Goal

`useKeyItem` enters blocking ~0.5–0.8s: frontal arc (~150°) reduces damage
70–90%; movement slowed or rooted; chip damage from behind.

## Acceptance Criteria

- Cooldown ~3–4s (longer than dodge).
- `blockingUntil` or flag checked in damage pipeline (all enemy hit types that
  apply to players).
- Cannot stack with dodge i-frames in a broken way (document priority).
- Client: shield pose or VFX on facing direction.
- Tests: frontal hit reduced; rear hit full; expires after duration.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
