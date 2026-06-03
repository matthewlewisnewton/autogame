# Resolve inventory instance IDs in the deck viewer grid

The deck viewer (V key) shows a count like "Deck: 5/12" but renders no card
tiles in `#deck-viewer-grid`. Root cause: the server's `player.deck` draw pile
stores entries that are either plain card ids **or inventory instance IDs** (for
owned/forged cards — see `resolveDeckEntry` in `game/server/progression.js`).
The deck viewer's `resolveDeckCardId` (`game/client/deck-viewer.js`) only calls
`getCardDef` on the raw entry, so instance-ID entries resolve to `null` and get
filtered out — leaving the grid empty while the count uses raw `deck.length`.
Fix the render path so instance-ID entries resolve to their card and render as
tiles, exactly like the HUD's `resolveDeckEntryCardId` already does.

## Acceptance Criteria

- `buildDeckMiniEntries` in `game/client/deck-viewer.js` accepts the player
  inventory (an array of `{ instanceId, cardId, ... }` instances) and resolves
  any deck entry that is an inventory instance ID to its underlying `cardId`
  before building the mini-entry; plain card-id entries continue to resolve as
  before.
- A deck made entirely of inventory instance IDs (entries that are NOT card
  def ids but DO match `inventory[].instanceId`) produces one mini-entry per
  resolvable card — i.e. the returned array length equals the number of
  resolvable entries, not `0`.
- `renderDeckViewer` in `game/client/main.js` passes the current player's
  inventory into `buildDeckMiniEntries` so the rendered `#deck-viewer-grid`
  tile count matches the resolvable draw-pile size (no longer empty when the
  count is non-zero).
- Mixed decks (some plain card ids, some instance ids) and unresolvable
  entries (neither a card def nor a known instance id) are handled gracefully:
  resolvable entries render, unresolvable ones are skipped without throwing.
- Evolved / desperation styling, icon, color, and name metadata still come from
  the resolved card def (existing behaviour preserved for plain-id decks).
- Existing client + server tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/client/deck-viewer.js`:
  - Update `resolveDeckCardId(entry, inventory)` (or add inventory handling)
    so that when `migrateCardId(entry)` does not match a `getCardDef`, it falls
    back to looking up `inventory.find(i => i && i.instanceId === entry)` and
    returns `instance.cardId` (validated via `getCardDef`). Mirror the logic in
    `resolveDeckEntryCardId` (`game/client/vanguard-hud.js:27`).
  - Thread an `inventory` parameter through `buildDeckMiniEntries(deckIds,
    inventory)` and use it when resolving each entry. Keep the function pure and
    tolerant of `undefined`/non-array inventory (default to no instance lookup).
- `game/client/main.js`:
  - In `renderDeckViewer` (~line 2025), pass the player's inventory into
    `buildDeckMiniEntries(displayIds, inventory)`. Use the same inventory source
    `renderDeckViewer`/`updateDeckStats` already rely on — the current
    `serverPlayer.inventory` (e.g. `gameState.players[myId].inventory`) or the
    `myInventory` fallback — consistent with the `updateDeckStats(deck, hand,
    serverPlayer?.inventory)` call at ~line 1979.
  - Desperation view (`deckIdsForDisplay(desperationDeck)`) uses plain card ids
    and must keep working; passing inventory there is harmless.
- `game/client/test/deck-viewer.test.js`:
  - Add coverage for instance-ID resolution: a deck of instance IDs plus a
    matching inventory yields the expected mini-entries; existing plain-id tests
    must still pass (call sites without inventory keep working).
- Do NOT change server code or the wire format; the server already sends both
  `deck` and `inventory` to the client. This is purely a client render-path fix.

## Verification: code
