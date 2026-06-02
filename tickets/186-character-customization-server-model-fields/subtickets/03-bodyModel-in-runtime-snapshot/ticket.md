# 03 — Wire bodyModel into player runtime state and stateUpdate snapshot

Ensure the `bodyModel` field flows from the account cosmetic through the player runtime record and into the `stateSnapshot()` so all connected clients can see each player's chosen model. This mirrors the existing `bodyShape` wiring from ticket 181.

## Acceptance Criteria
- `buildPlayerRecord()` attaches `cosmetic.bodyModel` from the account record to the player runtime (already happens via the full `cosmetic` object, but verify the field is present).
- `stateSnapshot()` includes `bodyModel` in each player's `cosmetic` sub-object (should happen automatically since the full cosmetic is attached, but add an explicit test).
- Integration test: after PATCHing `bodyModel` via the profile API, a newly built player record carries the updated `bodyModel` in its cosmetic.
- Integration test: `stateSnapshot()` reflects the `bodyModel` for all players.
- Default fallback: if a player record lacks `bodyModel` in its cosmetic, the snapshot still carries a valid default (`'default'`).
- Existing cosmetic fields in the snapshot (`bodyColor`, `accentColor`, `bodyShape`) remain unchanged.

## Technical Specs
- **Changed file:** `game/server/index.js` — verify `buildPlayerRecord()` cosmetic attachment includes `bodyModel` (likely no code change needed since the full cosmetic object is attached)
- **Changed file:** `game/server/progression.js` — verify `stateSnapshot()` cosmetic includes `bodyModel` (likely no code change needed)
- **Changed file:** `game/server/test/cosmetic_runtime.test.js` — add tests asserting `bodyModel` appears in `buildPlayerRecord()` output and in `stateSnapshot()` player entries
- No new exports needed; the cosmetic object already flows through the existing pipeline

## Verification: code
