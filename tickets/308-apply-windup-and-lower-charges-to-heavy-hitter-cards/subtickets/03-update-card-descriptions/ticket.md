# 03-update-card-descriptions

Add `description` text to Solar Edge (flame_blade) and Corebreaker Greatsword (magma_greatsword) in `cardDefs.json` to convey their heavy wind-up commitment to players who inspect the cards in the codex, deck viewer, or reward-choice UI.

## Acceptance Criteria

- `game/shared/cardDefs.json` has a `description` field on `flame_blade` mentioning the heavy wind-up commitment
- `game/shared/cardDefs.json` has a `description` field on `magma_greatsword` mentioning the heavy wind-up commitment
- Descriptions are visible in the card reward-choice overlay (rendered via `renderCardChoices()` in `main.js`) which reads `choice.description`
- Descriptions are visible in the key-item codex view (rendered via `def.description` at `main.js:3421`)
- All existing tests still pass (`pnpm test`)

## Technical Specs

- **game/shared/cardDefs.json** — add `"description"` field to both `flame_blade` and `magma_greatsword` entries. Example text should convey the heavy, committed nature of the strike (e.g. "Heavy committed strike — locks you during wind-up" or similar). Keep descriptions under ~80 characters for UI readability.
- No code changes needed — descriptions flow through the existing merge in `cards.js` (`{ ...cardIdentity[id], ...cardStats[id] }`) and are already rendered by `renderCardChoices()` and the codex view.

## Verification: code
