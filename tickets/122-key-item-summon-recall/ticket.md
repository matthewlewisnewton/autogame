# Key Item: Summon Recall

**Recall Whistle** (`summon_recall`) — teleports all of the caster's minions to
ring positions around the player.

## Difficulty: medium

## Goal

Implement `summon_recall` in `useKeyItem`: reposition every minion with
`ownerId === playerId` near the caster without clipping through walls.

## Acceptance Criteria

- Cooldown ~8–12s in `KEY_ITEM_DEFS`.
- No minions owned → soft-fail message, **no cooldown burn** (or document if burned).
- Valid positions on walkable floor (`isInsideDungeon` / `sampleFloorY` if 117 done).
- Minions spread in a ring (~1.5–2.5m); retain HP/TTL/AI state.
- Socket/state broadcast so clients see the teleport.
- Tests: two minions recall to new coords; wall clamp; wrong owner untouched.
- Lobby equip list shows item (from 118 defs).

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [119-key-item-input-bindings-and-settings](tickets/119-key-item-input-bindings-and-settings/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/) (reference `useKeyItem` pattern)

## Verification

`Verification: code`
