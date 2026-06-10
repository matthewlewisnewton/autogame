# Integrate the level-select map into the lobby

Wire the `levelMap.js` module into the running game: capture the
`levelUnlockGraph` shipped on the `questUpdate` / `lobbyUpdate` payloads (ticket
388), render the level-select map in the lobby quest panel fronting the Contract
Terminal, keep it in sync with the current selection, and make clicking an
unlocked node select that level/tier to play (the lobby-finder menu is
unaffected).

## Acceptance Criteria

- `game/client/index.html` has a container (e.g.
  `<div id="level-map" class="level-map"></div>`) inside the quest panel
  (`#quest-board-wrapper`), placed ahead of `#quest-board`.
- `main.js` stores the incoming `levelUnlockGraph` from the payload: when a
  `questUpdate` or `lobbyUpdate` payload contains `levelUnlockGraph`, it is
  saved to a module-level variable and the level map is re-rendered.
- The level map is rendered via `renderLevelMap(levelMapEl, levelUnlockGraph,
  …)`, passing the current `selectedQuestId`/`selectedQuestTier` so the active
  node shows the `selected` class, and updates whenever the selection changes
  (i.e. `renderLevelMapState()` is called from `renderQuestBoardState` or the
  same place the quest board re-renders).
- Clicking an **unlocked** (or cleared) node emits
  `CLIENT_TO_SERVER.SELECT_QUEST` with `{ questId, tier }` (the same emit the
  quest board uses), guarded by `suspendedRunSummary` the same way the quest
  board selection is; clicking a locked node emits nothing.
- When the payload carries no `levelUnlockGraph` (e.g. unauthenticated), the map
  area renders empty without throwing and the existing quest board still works.

## Technical Specs

- `game/client/index.html`: add `<div id="level-map" class="level-map"></div>`
  inside `#quest-board-wrapper`, before `#quest-board` (around line 146).
- `game/client/main.js`:
  - Import `renderLevelMap` from `./levelMap.js`.
  - Add `const levelMapEl = document.getElementById('level-map');` near the
    other lobby element lookups (~line 209) and a module-level
    `let levelUnlockGraph = null;` near `selectedQuestId` (~line 2107).
  - In `applyQuestBoardFromPayload(data)` (~line 2153), if
    `data.levelUnlockGraph` is present (object with `nodes`), assign it to
    `levelUnlockGraph`. The existing `lobbyUpdate`/`questUpdate` guards already
    call `applyQuestBoardFromPayload`; extend those guard conditions
    (~lines 1949 and 1960) to also fire when `data.levelUnlockGraph` is present.
  - Add `function renderLevelMapState()` that calls
    `renderLevelMap(levelMapEl, levelUnlockGraph, { selectedQuestId,
    selectedQuestTier, onSelectNode })`, where `onSelectNode(questId, tier)`
    reuses the quest-board selection logic (bail if no socket; if
    `suspendedRunSummary` show `THEME.run.questSuspendedLocked`; else
    `socket.emit(CLIENT_TO_SERVER.SELECT_QUEST, { questId, tier: tier ?? 1 })`).
    Call `renderLevelMapState()` from inside `renderQuestBoardState()` so node
    selection highlight tracks the quest board.
- Add `game/client/test/levelMapIntegration.test.js` (vitest + jsdom): load a
  `questUpdate`-shaped payload containing `levelUnlockGraph` through the same
  code path (or test a small harness around `renderLevelMapState`), assert the
  `#level-map` container renders nodes from the graph, that the selected node
  reflects `selectedQuestId`/`selectedQuestTier`, and that invoking an unlocked
  node's selection calls the socket emit with the expected `SELECT_QUEST`
  payload. (If exercising main.js end-to-end is impractical, expose the needed
  hooks on `window` mirroring the existing `window.renderQuestBoardState` /
  `window.__getSelectedQuestId` test seams and assert through those.)

## Verification: code
