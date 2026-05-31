# Key Item: Flare Beacon

**Signal Flare** (`flare_beacon`) — reveal enemies in large radius on HUD/minimap
for a few seconds.

## Difficulty: easy

## Goal

`useKeyItem` marks all living enemies within ~20–30m for 3s (server sends ids +
positions; client highlights).

## Acceptance Criteria

- Cooldown ~10s.
- Works through walls (intel only).
- Clears marks when enemies die or timer ends.
- Tests: enemy in range gets `revealedUntil`; out of range does not.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
