# Combat mechanics: correct deck size, hand size, card types, and currency name

Fix stale values in the Combat Mechanics section of `game/docs/design.md` to match current code constants and themed names.

## Acceptance Criteria

- Deck max size corrected from "12" to "24" (matches `DECK_MAX_SIZE = 24` in `server/config.js` and `client/config.js`).
- Hand size corrected from "up to 4 cards" to "up to 6 cards" (matches `MAX_HAND_SLOTS = 6`).
- Card type names updated from generic "Weapons, Spells, Creatures, Enchantments" to themed names "Techniques, Invocations, Bound Forms, Arcana" (per `shared/theme.json`), with internal type strings noted in parentheses.
- Player-facing currency name corrected from "Magic Stones" to "Mystic Signal (MS)" (per `shared/theme.json`), while noting the internal variable names still use `magicStone*`.

## Technical Specs

- Edit only `game/docs/design.md`.
- Section: **Combat Mechanics** (Card Types subsection).
- Cross-check values against `game/server/config.js`, `game/client/config.js`, and `game/shared/theme.json`.

## Verification: code
