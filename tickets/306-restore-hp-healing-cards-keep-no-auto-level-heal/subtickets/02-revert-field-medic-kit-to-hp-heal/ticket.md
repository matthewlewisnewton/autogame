# 02 — Revert Field Medic Kit to HP heal (server)

The `field_medic_kit` key item was converted from an AoE HP heal to an AoE Magic-Stone restore. Revert: it should restore HP to all living, non-extracted allies within `healRadius` of the caster.

## Acceptance Criteria

- `KEY_ITEM_DEFS.field_medic_kit` has `hpRestore: 8` (no `msRestore` field)
- Using Field Medic Kit heals the caster and all living allies within 5 m by `hpRestore` HP (capped at `MAX_HP`)
- Dead or extracted players are skipped
- Out-of-range players are unchanged
- HP changes are visible in `stateSnapshot()` after use; Magic Stones are NOT changed
- `KEY_ITEM_HEAL_PULSE` event is still emitted (unchanged — client VFX already shows a heal ring)
- Existing `field_medic_kit.test.js` tests pass (updated to verify HP change, not MS change)

## Technical Specs

**`game/server/progression.js`** — In `KEY_ITEM_DEFS.field_medic_kit`:
- Replace `msRestore: 3` with `hpRestore: 8`
- Update `description` to mention HP: `"Restore HP for nearby allies in an area"`

**`game/server/keyItemEffects.js`** — In the `field_medic_kit` branch:
- Replace `const msRestore = def.msRestore != null ? def.msRestore : 3;` with `const hpRestore = def.hpRestore != null ? def.hpRestore : 8;`
- Inside the player loop, replace the direct `p.magicStones = Math.min(...)` assignment with `healPlayer(p.id, hpRestore)` (import `healPlayer` from `./simulation`)
- Rename `alliesRestored` counter to `alliesHealed` (keep the same socket payload key `alliesRestored` for backward compatibility, or rename — either is fine since it's an internal protocol)

**`game/server/test/field_medic_kit.test.js`** — Update all tests:
- `"two players in range both gain MS"` → verify both players gain HP (8 each), MS unchanged
- `"out-of-range player unchanged"` → verify p3 HP unchanged
- `"dead player skipped"` → verify dead player HP unchanged
- `"caster restores self when alone"` → verify caster HP increases by 8
- `"cooldown gate rejects rapid reuse"` → unchanged
- `"emits KEY_ITEM_HEAL_PULSE"` → unchanged

## Verification: code
