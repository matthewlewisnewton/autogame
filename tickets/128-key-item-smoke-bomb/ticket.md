# Key Item: Smoke Bomb

**Smoke Veil** (`smoke_bomb`) — short fog at feet; enemies lose accuracy or detection.

## Difficulty: medium

## Goal

`useKeyItem` spawns a 2s zone at player position: enemies targeting player have
reduced hit chance or pause targeting (pick one simple rule and document).

## Acceptance Criteria

- Cooldown ~8s.
- Zone follows player or stays fixed at cast point (document choice).
- Client smoke VFX.
- Tests: enemy ranged attack miss rate up or targeting cleared while in zone.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
