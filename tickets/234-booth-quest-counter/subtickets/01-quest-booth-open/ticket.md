# Quest booth opens the existing quest panel

Wire the hub `quest` booth (already an anchor in `generateHub`, driven by the
233 booth primitive's `boothInteract` → `boothAction` → `booth:action` window
event) so that walking up to it opens/focuses the existing inline quest panel
(`#quest-board`) where `selectQuest` already works. No new quest UI is built and
the always-visible 2D quest menu must keep working unchanged.

## Acceptance Criteria

- A new DOM-free helper module `game/client/questBooth.js` exports
  `QUEST_BOOTH_ID = 'quest'` and `isQuestBoothAction(detail)` that returns
  `true` only when `detail.boothId === 'quest'` (false for other booths,
  `null`, `undefined`, and `{}`), mirroring `launchBooth.js`.
- main.js adds a `booth:action` (`BOOTH_ACTION_EVENT`) window listener that, when
  `isQuestBoothAction(detail)` is true AND the current `gameState.gamePhase`
  is `'lobby'`, calls a new `openQuestPanel()` function. Other booth ids and
  non-lobby phases are ignored.
- `openQuestPanel()` reveals/focuses the existing quest panel: it scrolls
  `#quest-board-wrapper` into view (`scrollIntoView`) and the inline
  `#quest-board` remains the panel where quest cards are selected — no second
  quest UI is introduced.
- The existing 2D quest menu still works: clicking a quest in `#quest-board`
  still emits `selectQuest` via the existing `renderQuestBoardState` handler
  (main.js:1851), unchanged.
- A unit test `game/client/test/questBooth.test.js` covers `isQuestBoothAction`
  (true for `{ boothId: 'quest' }`, false for other ids / falsy details) and
  asserts that dispatching `BOOTH_ACTION_EVENT` with `boothId: 'quest'` triggers
  the open path while a non-quest booth id does not (mirroring
  `characterBooth.test.js`'s booth:action coverage).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- New file `game/client/questBooth.js`: pure helpers only (no `window`/`socket`
  references), structured like `game/client/launchBooth.js`. Export
  `QUEST_BOOTH_ID` and `isQuestBoothAction`. Reuse `getBoothDebugHook` from
  `launchBooth.js` rather than duplicating it (the debug hook itself lands in
  sub-ticket 02).
- `game/client/main.js`:
  - Import `{ QUEST_BOOTH_ID, isQuestBoothAction }` from `./questBooth.js`.
  - Add `function openQuestPanel()` near `renderQuestBoardState` (~line 1851)
    that guards on `gameState?.gamePhase === 'lobby'`, calls
    `questBoardWrapperEl?.scrollIntoView({ block: 'nearest' })` (add a
    `const questBoardWrapperEl = document.getElementById('quest-board-wrapper')`
    alongside the existing `questBoardEl` lookup at ~line 173), and leaves the
    inline `#quest-board` as the selection surface.
    Wrap any `scrollIntoView` call defensively (jsdom lacks it) so tests pass.
  - Register a `window.addEventListener(BOOTH_ACTION_EVENT, …)` that calls
    `openQuestPanel()` when `isQuestBoothAction(ev.detail)` and the phase is
    `lobby` — place it next to the existing `character` booth:action listener
    (~line 945).
- New file `game/client/test/questBooth.test.js`: vitest, mirroring
  `game/client/test/launchBooth.test.js` for the pure helper and the
  booth:action portion of `game/client/test/characterBooth.test.js`.
- Do NOT modify the server, `generateHub`, or the 233 booth primitive — the
  `quest` anchor and `boothAction` roundtrip already exist.

## Verification: code
