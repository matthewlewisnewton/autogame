# Update Field Medic Kit description text

`KEY_ITEM_DEFS.field_medic_kit.description` still says "Restore a portion of your health" even though the item is an AoE party heal that also restores Magic Stones. Update the definition so lobby UI and any other consumers of `keyItemDefs` show accurate copy.

## Acceptance Criteria

- `KEY_ITEM_DEFS.field_medic_kit.description` in `game/server/progression.js` mentions healing **nearby allies** (not solo self-heal wording).
- The same description mentions **Magic Stone restore** (or equivalent phrasing such as "magic stones").
- No other `field_medic_kit` def fields (`healPercent`, `healRadius`, `msRestore`, `cooldownMs`, etc.) are changed.

## Technical Specs

- **File**: `game/server/progression.js` — edit the `field_medic_kit` entry inside `KEY_ITEM_DEFS` (~line 583–592).
- Replace the `description` string only; keep it concise (one sentence) to match other key-item entries.
- The client lobby key-item list (`renderKeyItemList` in `game/client/main.js`) already renders `def.description` from the synced `keyItemDefs` payload — no client edit required unless tests hardcode the old string.

## Verification: code
