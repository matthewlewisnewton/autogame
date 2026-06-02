# 01 — Correct deck and hand sizes in Combat Mechanics

Update the Combat Mechanics intro in `game/docs/design.md` so deck and hand
limits match `DECK_MIN_SIZE`, `DECK_MAX_SIZE`, `MAX_HAND_SLOTS`, and
`OPENING_HAND_SIZE` in `game/server/config.js` (mirrored in `game/client/config.js`).
The current text caps the deck at 12 and the hand at 4 cards, which is wrong.

## Acceptance Criteria

- Only `game/docs/design.md` is modified.
- The Combat Mechanics paragraph no longer claims the deck is capped at 12 cards;
  it states the real lobby loadout range (4–24 cards, default loadout 12).
- The same paragraph no longer claims players hold “up to 4 cards” as the hand
  limit; it states six hand slots with four cards dealt at run open (opening hand).
- Existing section headings and structure in `design.md` are unchanged aside from
  this surgical wording fix.
- Wording is verified against `game/server/config.js` and
  `game/server/progression.js` (`validateDeck`, `initPlayerHand` / opening deal).

## Technical Specs

- Edit `game/docs/design.md` only — the `## Combat Mechanics` intro (currently
  the sentence beginning “Instead of standard weapons…”).
- Cross-check before editing:
  - `game/server/config.js`: `DECK_MIN_SIZE` (4), `DECK_MAX_SIZE` (24),
    `MAX_HAND_SLOTS` (6), `OPENING_HAND_SIZE` (4).
  - `game/server/progression.js`: deck validation and opening-hand deal logic.
  - `game/client/config.js` and `game/client/hand.js` for client parity.
- Replace inaccurate “up to 12” / “up to 4” phrasing with the verified limits;
  keep the sentence about cards mapping to inputs if it remains accurate.

## Verification: code
