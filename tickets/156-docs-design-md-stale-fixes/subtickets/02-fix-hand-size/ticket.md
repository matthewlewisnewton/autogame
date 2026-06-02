# Fix hand size: 4 → 6

The design doc says "hand of up to 4 cards" but the actual hand capacity is 6 (`MAX_HAND_SLOTS`). The value 4 is the opening hand size (`OPENING_HAND_SIZE`), not the max hand capacity.

## Acceptance Criteria

- `game/docs/design.md` reads "hand of up to 6 cards" (not 4).
- No other files are modified.
- The surrounding paragraph structure and headings are preserved.

## Technical Specs

- Edit `game/docs/design.md`, line in the "Combat Mechanics" section: change "up to 4 cards" to "up to 6 cards".
- Cross-reference: `MAX_HAND_SLOTS = 6` in `game/server/config.js` and `game/client/config.js`.

## Verification: code
