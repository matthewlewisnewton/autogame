## Rename Stale Healing Metadata
`healing_font` and `divine_grace` now restore HP, but their shared `specialEffect` value is still `mana_restore`, and a client test asserts that stale value for Sanctum Pulse. Gameplay and rendering are already correct because dispatch keys by card id, but the metadata is misleading for future card work.
### Acceptance Criteria
- `game/shared/cardStats.json` uses HP-oriented `specialEffect` names for `healing_font` and `divine_grace`, or documents why the old token is intentionally retained.
- Client/server tests no longer describe HP healing cards with Magic Stone-oriented metadata.

## Refresh Field Medic Kit Debug Copy
The existing `medic-kit-ready` debug scenario comment still says it tests Field Medic Kit Magic Stone restore even though the key item now restores HP. This is harmless at runtime but confusing for QA and future scenario authors.
### Acceptance Criteria
- `game/server/debugScenarios.js` describes `medic-kit-ready` as an HP-heal scenario.
- Any test fixtures or comments that still describe Field Medic Kit as restoring Magic Stones are updated to HP wording.
