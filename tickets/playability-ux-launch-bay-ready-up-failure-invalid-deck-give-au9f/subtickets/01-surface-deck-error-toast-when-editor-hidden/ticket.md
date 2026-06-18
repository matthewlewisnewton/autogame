# Surface deck validation errors when the deck editor is hidden

When ready-up fails at the Launch Bay booth, the server emits `DECK_ERROR` and the client calls `showDeckError`, but that only writes to `#deck-error` inside the hidden `#deck-editor` panel. Extend deck-error presentation so players always see a visible on-screen message (toast) when the deck editor is closed, while preserving the existing `#deck-error` inline panel when the editor is open.

## Acceptance Criteria

- With `#deck-editor` hidden (hub Launch Bay ready-up, deck booth not open), a `DECK_ERROR` whose reason is e.g. `Deck must have at least 4 cards` shows a visible toast on `document.body` containing that message (or clearer copy that mentions opening the Deck booth and the 4-card minimum).
- `#deck-error` is still populated and shown when `#deck-editor` is visible (deck booth open); existing deck-editor error behavior is unchanged.
- Deck errors routed through the shop tab (`showShopError`) are unchanged.
- A vitest in `game/client/test/main.test.js` triggers `deckError` with a hidden `#deck-editor` and asserts a toast element with the error text exists on `document.body`.

## Technical Specs

- **`game/client/main.js`** — Update `showDeckError(message)`:
  - Keep writing `message` into `#deck-error` and toggling its display as today.
  - When `deckEditorEl` (or `#deck-editor`) has the `hidden` class / is not visible, also call `showTransientToast` (same pattern as `showCardErrorToast` ~line 4101) so the message is visible outside the lobby overlay.
  - Optionally map the server's `Deck must have at least N cards` reason to friendlier copy such as `Deck too small — open the Deck booth (need 4+ cards)` when the editor is hidden.
- **`game/client/test/main.test.js`** — Add a test alongside the existing `cardError` toast test (~line 2743): ensure `#deck-editor` has `hidden`, fire `deckError` via `window.__triggerSocketEvent`, assert a body toast contains the reason text.

## Verification: code
