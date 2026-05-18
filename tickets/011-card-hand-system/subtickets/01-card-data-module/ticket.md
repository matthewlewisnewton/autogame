# Card Data Module

Create a shared card data module (`game/client/cards.js`) containing card type definitions and a default starting deck. This module supplies the data that the rest of the hand system consumes.

## Acceptance Criteria
- `game/client/cards.js` exists and exports a `CARD_DEFS` lookup (object or map keyed by card id)
- Each card definition has `{ id, name, type, charges }` where `type` is one of `"weapon"`, `"summon"`, `"monster"`
- At least 4 distinct card definitions are provided so a full starting hand is possible
- The module exports a `createStartingDeck()` function returning an array of card id strings (at least 8 cards so draws beyond the initial hand are possible)
- The module exports a `CARD_TYPE_STYLE` map giving a CSS color and a short icon/label per card type

## Technical Specs
- **New file**: `game/client/cards.js` — ES module, no imports from the rest of the app
- `CARD_DEFS` example entries: a weapon card (multi-use, 5 charges), a summon (single-use, 1 charge), a monster card, and a second weapon
- `createStartingDeck()` returns an array of id strings; the first 4 become the initial hand
- `CARD_TYPE_STYLE` maps `"weapon"` → `{ color: '#60a5fa', icon: '⚔' }`, `"summon"` → `{ color: '#f59e0b', icon: '✦' }`, `"monster"` → `{ color: '#a78bfa', icon: '🐉' }` (or similar distinct values)

## Verification: code
