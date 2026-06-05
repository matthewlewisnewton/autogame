# Deck booth opens the loadout editor

Wire the hub **deck** booth terminal so a successful `boothAction` shows the existing
2D loadout UI (`#deck-editor` / Loadout Bay tab) without replacing or duplicating
deck-editor logic. Reuse `setLobbyTab`, `showGameLobby`, and `renderDeckEditor`.

## Acceptance Criteria

- A `window` listener on `booth:action` (`BOOTH_ACTION_EVENT` from
  `boothPrompt.js`) handles payloads where `action === 'deck'` (or
  `boothId === 'deck'`) and calls a single exported `openDeckBooth()` helper.
- After `openDeckBooth()`: `#lobby` is visible (not `hidden`), `activeLobbyTab`
  is `'deck'`, `#deck-editor` is visible, and other lobby tab panels (`#card-shop`,
  `#photon-forge`, etc.) stay hidden.
- `renderDeckEditor()` runs so owned cards and the active loadout list are
  populated from current client deck state (same data path as today’s tab click).
- With a mocked socket, clicking a rendered `.deck-add-btn` still emits
  `deckAddCard` with the expected `{ cardId }` / `{ instanceId, cardId }` payload
  (deck editor behavior unchanged; only the open path is new).
- `pnpm test` passes, including a new `game/client/test/boothDeck.test.js`.

## Technical Specs

- **New** `game/client/boothDeck.js` — export `openDeckBooth({ render })` that
  calls injected dependencies (`showGameLobby`, `setLobbyTab('deck')`,
  `renderDeckEditor`) so the module stays unit-testable without importing all of
  `main.js`. Export `registerDeckBoothListener()` that attaches the
  `booth:action` listener once.
- `game/client/main.js` — import `registerDeckBoothListener` and call it during
  client bootstrap (after socket/DOM setup, alongside existing booth prompt
  wiring). Pass the real `showGameLobby`, `setLobbyTab`, and `renderDeckEditor`
  closures. Do **not** add a second `boothAction` socket handler; keep the
  existing `dispatchBoothAction` path from ticket 233.
- **New** `game/client/test/boothDeck.test.js` — jsdom/vitest: dispatch
  `CustomEvent('booth:action', { detail: { boothId: 'deck', action: 'deck' } })`
  and assert deck tab + `#deck-editor` visibility; stub socket and assert
  `deckAddCard` emit from an add button after `__setDeckState` + `renderDeckEditor`.
- No server changes (`boothInteract` / `boothAction` for `deck` already exist in
  `game/server/socketHandlers/lobbyHandlers.js`).

## Verification: code
