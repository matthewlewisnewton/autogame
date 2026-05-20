# Lobby Card Sell and Trade Economy

Add the second half of a *Lost Kingdoms 1 & 2*-inspired card acquisition loop:
after runs, players should be able to turn extra cards into currency and trade
cards with another connected player from the lobby.

## Difficulty: medium

## Source Material Note

The design doc says players gather loot/cards in dungeons and then return to
the lobby to "trade or sell their loot to customize their combat decks." Current
deck editing covers selection, but not the economy decisions around duplicate
or unwanted cards. This ticket adds the smallest useful sell/trade layer.

## Goal

The lobby should support two simple economy actions:

- sell an owned card copy for currency
- offer a one-for-one card trade to another lobby player

Keep it server-authoritative and lobby-only.

## Acceptance Criteria

- The server defines a sell value for each card, either in card definitions or a
  small `CARD_SELL_VALUES` table.
- In the lobby, a player can sell an owned card copy that is not currently needed
  to keep their selected deck valid.
- Selling a card decreases `ownedCards[cardId]` by exactly one and increases
  `currency` by the card's sell value.
- The server rejects selling the last copy of a card if that would make the
  player's selected deck invalid.
- The client deck/lobby UI shows owned card counts, sell value, and a Sell
  button per sellable card.
- A player can offer a one-for-one trade to another connected lobby player:
  `{ targetPlayerId, offeredCardId, requestedCardId }`.
- The target player can accept or reject the trade.
- On accept, the server validates both players still own the relevant cards and
  swaps exactly one copy each.
- Trades are only allowed in lobby phase.
- Deck validity is preserved for both players after a sale or trade.

## Implementation Notes

- Keep trade state in server memory only. Persistence belongs to a later ticket.
- Suggested events:
  - `sellCard` with `{ cardId }`
  - `offerCardTrade` with `{ targetPlayerId, offeredCardId, requestedCardId }`
  - `respondCardTrade` with `{ tradeId, accepted }`
  - `tradeUpdate` or `cardInventoryUpdate`
- Start with exact card-id requests only. Do not build a marketplace, auction
  house, asynchronous offers, or multi-card trades.
- Reuse existing deck validation helpers so a player cannot sell/trade away a
  card required by their current selected deck.
- Keep UI plain: one small economy section near the deck editor is enough.

## Test Snippet

Adapt this into `game/server/test/integration.test.js`:

```js
it('selling an extra owned card grants currency and preserves deck validity', async () => {
  const player = gameState.players[socket1.id];
  player.ownedCards.iron_sword = 3;
  player.selectedDeck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];
  const currencyBefore = player.currency;

  const updatePromise = waitForEvent(socket1, 'cardInventoryUpdate');
  socket1.emit('sellCard', { cardId: 'iron_sword' });
  await updatePromise;

  expect(player.ownedCards.iron_sword).toBe(2);
  expect(player.currency).toBeGreaterThan(currencyBefore);
  expect(player.selectedDeck).toEqual(['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake']);
});
```

Add a rejection test:

```js
it('rejects selling a card that is required by the selected deck', async () => {
  const player = gameState.players[socket1.id];
  player.ownedCards.flame_blade = 1;
  player.selectedDeck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];

  const errorPromise = waitForEvent(socket1, 'deckError');
  socket1.emit('sellCard', { cardId: 'flame_blade' });
  const err = await errorPromise;

  expect(err.reason).toMatch(/deck/i);
  expect(player.ownedCards.flame_blade).toBe(1);
});
```

Add one trade acceptance test that verifies both inventories change exactly once
and both selected decks remain valid.

## Files

- `game/server/index.js`
- `game/client/index.html`
- `game/client/main.js`
- `game/client/style.css`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`
- `game/client/test/main.test.js`

## Tests

- Unit test sell validation against selected deck requirements.
- Integration test successful sell updates currency and inventory.
- Integration test invalid sell is rejected without mutation.
- Integration test trade offer/accept swaps cards once.
- Integration test trade reject or invalid stale trade does not mutate
  inventories.
- Client test for economy section rendering if helper extraction is practical.

## Visual QA Checklist

- Earn or seed duplicate cards, return to lobby, and verify Sell buttons appear.
- Sell an extra card and verify currency and counts update.
- Try to sell a card required by the current deck and verify an error appears.
- With two clients in lobby, offer and accept a one-for-one trade.
- Verify both deck editors update after the trade.
