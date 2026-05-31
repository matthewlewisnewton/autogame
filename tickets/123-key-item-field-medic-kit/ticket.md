# Key Item: Field Medic Kit

**Field Medic Kit** (`field_medic_kit`) — small AoE heal HP + restore a few magic
stones for self and allies in radius.

## Difficulty: medium

## Goal

`useKeyItem` applies a pulse: allies in the same run within ~4–6m gain partial HP
(capped at max) and +2–4 MS (capped at `MAX_MAGIC_STONES`).

## Acceptance Criteria

- Cooldown ~6–8s.
- Affects caster + other `gameState.players` in radius; dead players skipped.
- Does not exceed `MAX_HP` / `MAX_MAGIC_STONES`.
- Party-safe in multiplayer lobby runs.
- Client VFX: brief green pulse; HUD shows heal numbers optional.
- Tests: two players in range both heal; out of range unchanged; cooldown gate.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [119-key-item-input-bindings-and-settings](tickets/119-key-item-input-bindings-and-settings/)
- [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)

## Verification

`Verification: code`
