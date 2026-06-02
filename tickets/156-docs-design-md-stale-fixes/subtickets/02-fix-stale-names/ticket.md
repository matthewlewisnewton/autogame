# Fix stale resource and card names in design.md

Update "Magic Stones" → "Mystic Signal" and fix example card names ("Battle Familiar" → "Signal Familiar", "Mana Leach" → "Ether Siphon") in `game/docs/design.md` to match themed names in `theme.json` and card definitions.

## Acceptance Criteria

- All occurrences of "Magic Stones" in `game/docs/design.md` are replaced with "Mystic Signal" (matching `theme.json` resource naming)
- "Battle Familiar" is updated to "Signal Familiar" (matches `game/server/progression.js` card name)
- "Mana Leach" is updated to "Ether Siphon" (matches `game/client/cards.js` card name)
- No other files are modified
- The doc's existing structure and headings are preserved

## Technical Specs

- Edit only `game/docs/design.md`
- Replace "Magic Stones" → "Mystic Signal" (theme.json: `resource.full = "Mystic Signal"`, short = "MS")
- Replace "Battle Familiar" → "Signal Familiar" (server/progression.js line 111)
- Replace "Mana Leach" → "Ether Siphon" (client/cards.js line 284)
- These are named examples in the Playtesting Notes section and the Card Types description

## Verification: code
