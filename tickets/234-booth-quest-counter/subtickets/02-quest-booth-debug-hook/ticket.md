# ?booth=quest debug hook

Add a localhost-gated `?booth=quest` debug hook that jumps straight to the quest
panel on lobby join, so the quest booth can be exercised without walking the hub
— mirroring the existing `?booth=character` hook in `requestBoothDebugOpen()`.

## Acceptance Criteria

- Loading the client with `?booth=quest` on localhost (one of `localhost`,
  `127.0.0.1`, `::1`) opens the quest panel once after the lobby is joined and
  the phase is `'lobby'`, by calling the `openQuestPanel()` added in
  sub-ticket 01.
- The hook is gated exactly like the existing character hook: it only fires when
  `debugScenarioAllowed` is true (the localhost check at main.js:857). On a
  non-localhost host, `?booth=quest` does nothing.
- The hook fires at most once per session (guarded by the existing
  `boothDebugRequested` flag), and is invoked from the same `requestBoothDebugOpen()`
  call site that already runs on lobby join (`renderHubScene`, main.js:708).
- `?booth=character` continues to open the character booth unchanged; an absent
  or unrelated `?booth=` value opens neither.
- A test asserts that `?booth=quest` is recognized and gated to localhost
  (extend `game/client/test/questBooth.test.js`, or add server/client coverage
  alongside the existing debug-gate tests) — e.g. `getBoothDebugHook('?booth=quest')`
  returns `'quest'` and the non-localhost gate suppresses the open.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/client/main.js`, `requestBoothDebugOpen()` (~line 1885): generalize the
  current `if (boothDebugParam !== 'character' …) return;` so it dispatches on
  `boothDebugParam`:
  - `'character'` → `openCharacterBooth()` (existing behavior, unchanged).
  - `'quest'` → `openQuestPanel()` (from sub-ticket 01).
  - keep the `debugScenarioAllowed`, `boothDebugRequested`, and
    `gameState.gamePhase === 'lobby'` guards intact for both branches.
  - `boothDebugParam` is already parsed at main.js:858; reuse it (or
    `getBoothDebugHook(window.location.search)` from `questBooth.js`/`launchBooth.js`).
- Extend `game/client/test/questBooth.test.js` with the debug-hook gating
  assertions; if a running-state test is impractical in jsdom, assert the
  helper + gate logic (`getBoothDebugHook` value and the `debugScenarioAllowed`
  host check) the way `game/server/test/debug-gate.test.js` checks gating.
- Depends on sub-ticket 01 (`openQuestPanel()` and `questBooth.js` must exist).
- Do NOT modify the server or the 233 booth primitive.

## Verification: code
