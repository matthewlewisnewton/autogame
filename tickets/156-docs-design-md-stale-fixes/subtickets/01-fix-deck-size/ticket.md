# Fix deck size: 12 → 24

The design doc says "deck of up to 12 cards" but the actual limit is 24 (`DECK_MAX_SIZE` in `game/server/config.js` and `game/client/config.js`).

## Acceptance Criteria

- `game/docs/design.md` reads "deck of up to 24 cards" (not 12).
- No other files are modified.
- The surrounding paragraph structure and headings are preserved.

## Technical Specs

- Edit `game/docs/design.md`, line in the "Combat Mechanics" section: change "up to 12 cards" to "up to 24 cards".
- Cross-reference: `DECK_MAX_SIZE = 24` in `game/server/config.js` and `game/client/config.js`.

## Verification: code
