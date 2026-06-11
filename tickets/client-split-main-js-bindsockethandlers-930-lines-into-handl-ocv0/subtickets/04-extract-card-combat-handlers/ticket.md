# Extract card and combat-feedback socket handlers

## Description

Move card-use rendering and lightweight combat feedback listeners into `bindCardHandlers`. Relocate the `cardRenderCtx` bundle alongside these handlers since only `CARD_USED` consumes it.

## Acceptance Criteria

- `game/client/socketHandlers/cardHandlers.js` exports `bindCardHandlers(s, ctx)` registering: `CARD_USED`, `CARD_ERROR`, `VOLATILE_EXPLOSION`, `SPIKE_TRAP_TRIGGERED`, `LEECH_HEAL`, `SHIELD_BREAK`, and the `QUEST_DIALOGUE` handler that calls `handleQuestDialogue` (the first registration in current `main.js`, ~line 1710)
- `cardRenderCtx` moves out of `main.js` into `cardHandlers.js` (or is exposed on ctx as `ctx.cardRenderCtx`); `renderCardUsed(data, cardRenderCtx)` behavior unchanged
- `bindSocketHandlers` delegates to `bindCardHandlers`; no duplicate registrations for these events remain in `main.js`
- Card error toast / `.no-ms` slot class behavior preserved on insufficient MS
- `game/client/test/cardRenderers.test.js` and `main.test.js` card-related suites pass

## Technical Specs

- **Add:** `game/client/socketHandlers/cardHandlers.js` — include `cardRenderCtx` object with renderer/audio helpers and `get myId()` getter
- **Edit:** `game/client/socketHandlers/socketHandlerCtx.js` — pass renderer spawn helpers, `getScene`, `playSound`, `showCardErrorToast`, `handleQuestDialogue`, `THEME`, `lastUsedSlot`/`getCardSlotEl` accessors as needed
- **Edit:** `game/client/main.js` — remove `cardRenderCtx` declaration and inline handlers (~lines 1197–1224 and ~1671–1723 minus any handlers not listed above); call `bindCardHandlers(s, socketHandlerCtx)`

## Verification: code
