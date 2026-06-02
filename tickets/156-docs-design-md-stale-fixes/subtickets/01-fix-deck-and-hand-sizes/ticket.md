# Fix deck and hand size claims in design.md

Correct two outdated numeric claims in `game/docs/design.md` that no longer match the current codebase constants.

## Acceptance Criteria

- `game/docs/design.md` "deck of up to 12 cards" is updated to "deck of up to 24 cards" (matching `DECK_MAX_SIZE = 24` in `game/server/config.js`).
- `game/docs/design.md` "hand of up to 4 cards" is updated to "hand of up to 6 cards" (matching `MAX_HAND_SLOTS = 6` in `game/server/config.js`).
- No other files are modified.
- The doc's existing structure and headings are preserved — only the two numeric values change.

## Technical Specs

- Edit only `game/docs/design.md`.
- In the **Combat Mechanics** section, change "deck of up to 12 cards" → "deck of up to 24 cards".
- In the **Combat Mechanics** section, change "hand of up to 4 cards" → "hand of up to 6 cards".
- Verify constants in `game/server/config.js` (`DECK_MAX_SIZE`, `MAX_HAND_SLOTS`) before editing.

## Verification: code
