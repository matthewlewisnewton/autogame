# Fix wrong deck/hand size numbers in design.md

Correct the deck max size (12 → 24) and hand max size (4 → 6) in `game/docs/design.md` to match `DECK_MAX_SIZE` and `MAX_HAND_SLOTS` in `config.js`.

## Acceptance Criteria

- `game/docs/design.md` states deck max size is **24** (not 12)
- `game/docs/design.md` states hand max size is **6** (not 4), noting that the opening hand dealt is 4
- No other files are modified
- The doc's existing structure and headings are preserved

## Technical Specs

- Edit only `game/docs/design.md`
- Change "deck of up to 12 cards" → "deck of up to 24 cards" (matches `DECK_MAX_SIZE = 24` in both `game/server/config.js` and `game/client/config.js`)
- Change "hand of up to 4 cards" → "hand of up to 6 cards" (matches `MAX_HAND_SLOTS = 6`; opening deal remains 4 via `OPENING_HAND_SIZE`)

## Verification: code
