# Retire the always-visible 2D quest board menu

The quest board (`#quest-board-wrapper`) is currently always visible in the
lobby. Make it no longer an always-on 2D menu: it is hidden by default and
revealed only by the quest booth. Quest selection still flows through the same
`#quest-board` element, so `selectQuest` keeps working from the booth.

## Acceptance Criteria

- The quest board is no longer always visible in the lobby — `#quest-board-wrapper`
  is hidden by default when the lobby is shown.
- The quest booth reveals the quest board, and `selectQuest` works from it; the
  `?booth=quest` debug hook still opens it.
- The `#lobby-browser` (lobby-finder) menu is unchanged.
- Tests green (`pnpm test` server + client).

## Technical Specs

- `game/client/index.html`: give `#quest-board-wrapper` a default-hidden state
  (e.g. add the `hidden` class) so it is not part of the always-visible lobby
  chrome. Keep `#quest-board` / `#quest-error` inside it.
- `game/client/main.js`: `openQuestPanel()` (the quest-booth handler) must
  un-hide `#quest-board-wrapper` (not just `scrollIntoView`); ensure the wrapper
  is re-hidden when the lobby is (re)shown so it only appears via the booth.
  Keep `renderQuestBoardState` / `applyQuestBoardFromPayload` wiring.
- `game/client/questBooth.js`, `game/client/questBoard.js`: unchanged behavior —
  quest booth action still routes to `openQuestPanel`; selection handler intact.
- Update affected tests: `game/client/test/questBoard.test.js`,
  `questBooth.test.js`, `main.test.js` — adjust fixtures/assertions for the
  default-hidden quest board.

## Verification: code
