# Key Item Definitions Registry

Define `KEY_ITEM_DEFS` in `progression.js` mirroring the `CARD_DEFS` pattern. Register all 14 key items with their `id`, `name`, `description`, `cooldownMs`, and type-specific fields. Only `dodge_roll` needs a complete implementation; others return `{ ok: false, reason: 'not_implemented' }` when used.

## Acceptance Criteria
- `KEY_ITEM_DEFS` exists in `game/server/progression.js` as a plain object mapping string IDs to definition objects
- All 14 key items are registered: `dodge_roll`, `summon_recall`, `field_medic_kit`, `guard_block`, `flare_beacon`, `loot_magnet`, `overclock`, `smoke_bomb`, `ground_anchor`, `phase_step`, `purge_charm`, `echo_strike`, `barrier_dome`, `rally_cry`
- Each entry has: `id` (string), `name` (display string), `description` (string), `cooldownMs` (number), and type-specific fields
- `dodge_roll` has a complete definition with reasonable cooldown (e.g. 500ms–1000ms)
- A helper function `getKeyItemDef(id)` returns the definition or `undefined` for unknown IDs
- `KEY_ITEM_DEFS` and `getKeyItemDef` are exported from `progression.js` module.exports

## Technical Specs
- **File:** `game/server/progression.js`
  - Add `KEY_ITEM_DEFS` object after `CARD_DEFS` — plain object with 14 entries
  - Add `getKeyItemDef(id)` — returns `KEY_ITEM_DEFS[id] || undefined`
  - Add both to `module.exports` at bottom of file

## Verification
- `Verification: code`
