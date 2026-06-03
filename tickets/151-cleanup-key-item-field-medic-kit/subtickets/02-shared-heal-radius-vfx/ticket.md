# Shared heal radius for Field Medic Kit pulse VFX

`triggerHealPulseVFX` hardcodes `healRadius = 5` while the server reads `def.healRadius` from `KEY_ITEM_DEFS`. Parameterize the client VFX so ring scale tracks the server definition without a magic number in `renderer.js`.

## Acceptance Criteria

- `triggerHealPulseVFX` in `game/client/renderer.js` does **not** contain a hardcoded heal radius of `5`; it uses a `healRadius` argument (or reads from a passed-in def object).
- `game/client/main.js` passes the radius from `keyItemDefs.field_medic_kit.healRadius` when calling `triggerHealPulseVFX` (with a sensible fallback only if the def is missing).
- Changing `healRadius` in `KEY_ITEM_DEFS.field_medic_kit` (`game/server/progression.js`) is sufficient to change the pulse max scale — no edit to `renderer.js` required for tuning.
- Existing caster-only VFX behavior on `keyItemUsed` is unchanged (still one pulse on the using client).

## Technical Specs

- **File**: `game/client/renderer.js` — change `triggerHealPulseVFX(position)` to `triggerHealPulseVFX(position, healRadius)` (or equivalent). Replace the local `const healRadius = 5` with the parameter throughout the expand/fade scale math (~lines 1404–1436).
- **File**: `game/client/main.js` — in the `keyItemUsed` handler where `field_medic_kit` triggers the pulse (~lines 1129–1133), read `keyItemDefs.field_medic_kit?.healRadius` and pass it to `triggerHealPulseVFX`.
- Follow the existing pattern of `PHASE_STEP_RANGE` in `renderer.js` (comment noting server def parity) if adding a brief comment is helpful; prefer reading live `keyItemDefs` over duplicating a client constant.
- Do **not** add server or socket changes in this sub-ticket.

## Verification: code
