# Extract lobby feature socket handlers

## Description

Move squad-lobby and hub-feature socket listeners (deck, booth, medic, key items, trade, quest board, cosmetics, card forge/grind) into `bindLobbyHandlers`. These are the handlers that fire while players manage loadouts and hub services, distinct from connection, state sync, and run lifecycle.

## Acceptance Criteria

- `game/client/socketHandlers/lobbyHandlers.js` exports `bindLobbyHandlers(s, ctx)` with handlers moved verbatim for: `LOBBY_UPDATE`, `DECK_UPDATE`, `DECK_ERROR`, `BOOTH_ACTION`, `BOOTH_ERROR`, `MEDIC_HEALED`, `MEDIC_ERROR`, `MEDIC_ALLY_HEAL`, `MEDIC_BEAD`, `KEY_ITEM_EQUIPPED`, `KEY_ITEM_ERROR`, `KEY_ITEM_HEAL_PULSE`, `KEY_ITEM_USED`, `CARD_EVOLUTION_RESULT`, `CARD_EVOLUTION_ERROR`, `CARD_INVENTORY_UPDATE`, `CARD_GRIND_RESULT`, `CARD_GRIND_ERROR`, `HAT_UNLOCKED`, `HAT_ERROR`, `APPEARANCE_CHANGED`, `APPEARANCE_ERROR`, `TRADE_OFFER`, `TRADE_UPDATE`, `QUEST_UPDATE`, `QUEST_ERROR`, the `QUEST_DIALOGUE` handler that calls `showQuestDialogueToast` (second registration, ~line 2041), `HUB_PRESENCE_UPDATE`, and `PLAYER_RECONNECTED`
- `bindSocketHandlers` delegates to `bindLobbyHandlers`; no duplicate `s.on` for these events in `main.js`
- Both `QUEST_DIALOGUE` registrations remain (different callbacks — do not merge)
- Deck editor, medic booth, key-item HUD, trade overlay, quest board, forge/shop tab refresh behavior unchanged
- Relevant `game/client/test/main.test.js` and feature tests (`deck-loadout`, `boothDeck`, `questBoard`, etc.) pass

## Technical Specs

- **Add:** `game/client/socketHandlers/lobbyHandlers.js`
- **Edit:** `game/client/socketHandlers/socketHandlerCtx.js` — expose lobby-feature deps (`activeLobbyTab`, `pendingTradeOffer`, `mySelectedDeck`, `myInventory`, `myOwnedCards`, `myCurrency`, `isReady`, medic/key-item/cosmetic/trade/quest render helpers, `MEDIC_HEAL_COST`, `APPEARANCE_CHANGE_COST`, etc.)
- **Edit:** `game/client/main.js` — remove inline handlers (~lines 1725–2013 and 2033–2044); call `bindLobbyHandlers(s, socketHandlerCtx)`

## Verification: code
