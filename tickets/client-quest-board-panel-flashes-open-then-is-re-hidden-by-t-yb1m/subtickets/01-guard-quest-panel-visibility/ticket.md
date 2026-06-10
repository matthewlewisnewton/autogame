# Guard quest panel visibility against lobby re-render loop

## Description

`openQuestPanel()` reveals `#quest-board-wrapper` by calling `showGameLobby()` then removing `'hidden'`. However `showGameLobby()` unconditionally re-adds `'hidden'` to the wrapper on every call, and the lobby-phase state-update path invokes `showGameLobby()` ~20/sec. Net effect: the quest panel is visible for at most one frame.

Fix: introduce a `questPanelOpen` flag so `showGameLobby()` skips hiding the quest board when it was explicitly opened by the booth interaction.

## Acceptance Criteria

- Pressing F at the Quest Board (or dispatching `booth:action` with `boothId: 'quest'`) shows the quest list and it **stays visible** across subsequent STATE_UPDATE cycles
- Calling `dismissGameLobby()` (Escape key or programmatic dismiss) resets the flag and re-hides the quest panel
- Calling `showGameLobby()` when the quest panel is NOT open still hides the wrapper (existing behavior preserved)
- All existing quest booth tests pass (updated to reflect new flag-based behavior)

## Technical Specs

**File:** `game/client/main.js`

1. Declare `let questPanelOpen = false;` near `lobbyMenuDismissed` (line ~335)
2. In `openQuestPanel()` (line ~2211): set `questPanelOpen = true` **after** removing `'hidden'` from `questBoardWrapperEl`
3. In `showGameLobby()` (line ~482): change `questBoardWrapperEl.classList.add('hidden')` to `if (!questPanelOpen && questBoardWrapperEl) questBoardWrapperEl.classList.add('hidden')`
4. In `dismissGameLobby()` (line ~462): set `questPanelOpen = false` before hiding the quest board wrapper
5. Export `questPanelOpen` state for tests: `window.__isQuestPanelOpen = () => questPanelOpen;`

**File:** `game/client/test/questBooth.test.js`

- Update test "re-hides the quest panel when the lobby is (re)shown": with the flag set by `openQuestPanel()`, calling `showGameLobby()` directly should **NOT** re-hide the panel (it should stay visible). Update assertion accordingly.
- Add test: after opening the quest panel, calling `dismissGameLobby()` resets `questPanelOpen` and re-hides the wrapper.

## Verification: code
