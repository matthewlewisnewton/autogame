## Ally-visible Field Medic Kit pulse VFX

`keyItemUsed` is only sent to the caster, so `triggerHealPulseVFX` runs on that client alone. Teammates see HP/MS change via `stateUpdate` but not the green ring. For party play, consider broadcasting a lightweight event (or deriving VFX from `stateUpdate` + `healed` count) so all clients show the pulse at the caster position.

### Acceptance Criteria
- When any player uses `field_medic_kit` in a multiplayer run, every connected client in that lobby sees the green heal pulse at the caster’s world position.
- Caster-only behavior is unchanged; no duplicate pulses on the using client.

## Shared heal radius between server and client VFX

`triggerHealPulseVFX` hardcodes `healRadius = 5` while the server reads `def.healRadius` from `KEY_ITEM_DEFS`. If tuning changes the def, VFX size will drift from gameplay radius.

### Acceptance Criteria
- Client pulse max scale uses the same radius value as server AoE (shared constant or payload on `keyItemUsed` / `stateUpdate`).
- Changing `healRadius` in `KEY_ITEM_DEFS` updates both heal logic and ring scale without editing `renderer.js` magic numbers.

## Field Medic Kit description text

`KEY_ITEM_DEFS.field_medic_kit.description` still says “Restore a portion of your health” though the item is an AoE party heal + MS restore.

### Acceptance Criteria
- In-game / data description mentions nearby allies and magic stone restore, matching ticket goal text.
