# 08 — Wire suspended-run resume and abandon controls in the browser

The hub lobby already has hidden `#resume-run-btn`, `#abandon-run-btn`, and `#suspended-run-banner` elements, and the server handles `abandonRun`, but the client never shows or wires them. Implement the suspended-run UI branch so players can resume the checkpointed run or abort it to start a fresh sortie with reset card charges through normal browser gameplay.

## Acceptance Criteria

- When `suspendedRunSummary` is present (from sub-ticket 07 state or `stateUpdate`), `#suspended-run-banner` is visible with copy naming the suspended quest (use `THEME.run` strings; e.g. resume banner referencing `questName`).
- `#resume-run-btn` is visible while suspended; clicking it triggers the existing ready-up / deploy flow to resume the same run (no new socket event needed — server `restoreCardCheckpoint()` on deploy when checkpoint exists).
- `#abandon-run-btn` (`THEME.run.abandonSortie` / "Abort Sortie") is visible while suspended; clicking it emits `CLIENT_TO_SERVER.ABANDON_RUN`, hides the suspended-run UI, and clears local `suspendedRunSummary`.
- After abandon succeeds (`stateUpdate` with null checkpoint), the squad can ready-up and deploy into a **new** sortie (fresh `runId`, card charges reset per server sub-ticket 03).
- While suspended, quest selection is blocked or read-only with explicit "resume or abort first" feedback (do not allow changing quest before abandon).
- Deploy button visibility: hidden during mid-run extraction overlay (`awaitingExtract`); shown for suspended-run resume alongside `#resume-run-btn`.
- **`game/client/test/main.test.js`** (or a focused client test): assert abandon button emits `abandonRun` and suspended UI clears on success.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/client/main.js`**:
  - Add `renderSuspendedRunBanner(summary)` (or equivalent) called from `runSuspended` handler and from `stateUpdate` when `suspendedRunSummary` is non-null during lobby phase.
  - Wire `#resume-run-btn` click → existing deploy/ready path (reuse deploy button handler or call the same function).
  - Wire `#abandon-run-btn` click → `socket.emit(CLIENT_TO_SERVER.ABANDON_RUN)`; on success via subsequent `stateUpdate`, call a `clearSuspendedRunUi()` helper.
  - Update `returnToGuildLobby()` / `showExtractedLobbyOverlay()` to distinguish **awaiting-extract** (squad still in dungeon) from **suspended** (checkpoint saved, all extracted) — only show resume/abandon controls for the latter.
  - Toggle `#resume-run-btn` / `#abandon-run-btn` visibility with the banner; hide all three when checkpoint clears.
- **`game/client/index.html`**: only if needed — ensure button ids/labels match `THEME.run.resumeSortie` / `THEME.run.abandonSortie` (buttons may stay static; JS can set text).
- **`game/server/socketHandlers/runHandlers.js`**: no handler changes expected (`ABANDON_RUN` already calls `abandonSuspendedRun`); verify error paths surface via existing `RUN_ERROR` if abandon fails.
- **`game/client/test/main.test.js`**: UI + socket emission test for abandon path.

## Verification: code
