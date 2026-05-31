# Key Item: Barrier Dome

**Barrier Dome** (`barrier_dome`) — 1s bubble blocking projectiles in 3m radius.

## Difficulty: medium

## Goal

`useKeyItem` creates `barrierDomeUntil` + radius: projectile/ranged enemy attacks
originating outside→inside are blocked; melee still works.

## Acceptance Criteria

- Cooldown ~14s.
- Co-op: dome centered on caster, helps allies inside.
- Tests: projectile damage blocked; melee still applies.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
