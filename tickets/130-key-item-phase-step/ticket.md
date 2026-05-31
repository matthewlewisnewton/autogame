# Key Item: Phase Step

**Phase Step** (`phase_step`) — swap positions with a targeted ally within 6m.

## Difficulty: hard

## Goal

`useKeyItem` with `targetPlayerId` (nearest ally in range if omitted): swap `x,z,y`
with ally; validate both positions inside dungeon.

## Acceptance Criteria

- Cooldown ~12s.
- Requires co-op ally in same run; solo → fail gracefully.
- No swap through walls (both endpoints valid).
- Client target highlight or auto-nearest.
- Tests: two players swap coords; out of range fails.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
