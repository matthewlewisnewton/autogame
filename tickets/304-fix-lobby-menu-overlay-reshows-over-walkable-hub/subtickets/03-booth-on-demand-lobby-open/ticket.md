# Booth and toggle on-demand lobby open

When the menu is dismissed, hub booth interactions must explicitly reopen the lobby overlay (or the relevant panel) on demand. Quest-board content lives inside `#lobby`, so the quest booth must show the menu before revealing its wrapper.

## Acceptance Criteria

- With `#lobby` dismissed, interacting with the **deck** booth (`booth:action` / `openDeckBooth`) shows `#lobby`, sets the deck tab active, and renders the deck editor.
- With `#lobby` dismissed, interacting with the **shop** booth shows `#lobby`, sets the shop tab active, and renders the card shop.
- With `#lobby` dismissed, interacting with the **quest** booth calls `showGameLobby()` then reveals `#quest-board-wrapper` (scroll into view).
- Character booth (`#character-booth-overlay`) continues to open independently without requiring the lobby menu.
- Optional but preferred: a keyboard toggle (e.g. `L` or `Tab` when not typing in an input) opens the lobby menu from the dismissed state while `gamePhase === 'lobby'`.
- Booth prompt (`#booth-prompt`) and canvas movement remain usable while the lobby menu is dismissed.

## Technical Specs

- `game/client/main.js`: update `openQuestPanel()` (or its `booth:action` listener) to call `showGameLobby()` before un-hiding `#quest-board-wrapper`; add keyboard toggle handler gated to lobby phase and not blocked by other overlays.
- `game/client/boothDeck.js`, `game/client/boothShop.js`: no change expected if they already call `showGameLobby()` via deps — verify and leave intact.
- `game/client/main.js`: ensure `isDebugGodmodeKeyBlocked` (or a shared key-block helper) excludes the new lobby toggle key when appropriate.
- `game/client/test/questBooth.test.js`: extend or add case asserting quest booth opens `#lobby` when it starts dismissed.

## Verification: code
