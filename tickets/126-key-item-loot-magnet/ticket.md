# Key Item: Loot Magnet

**Loot Magnet** (`loot_magnet`) — pull uncollected ground loot toward the player.

## Difficulty: easy

## Goal

`useKeyItem` moves loose loot entities (currency drops, ground cards if applicable)
within ~8m toward caster over ~0.3s or instant snap to pickup range.

## Acceptance Criteria

- Cooldown ~8s.
- Does not pull loot through walls; respects pickup rules.
- Tests: drop outside range moves closer; already collected ignored.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
