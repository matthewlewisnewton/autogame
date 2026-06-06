# Client solo telepipe suspend: abandon button and harness probes

Solo telepipe UP suspends immediately, but `showExtractedLobbyOverlay()` hides `#abandon-run-btn` before `RUN_SUSPENDED` lands, and `__AUTOGAME_HARNESS_STATE__` lacks `abandonRunBtnUsable` / `runId` probes the harness needs to distinguish abandon+fresh-deploy from resume. Add the minimal client test hooks so `abandonSuspendedRun()` can click Abort Sortie reliably.

## Acceptance Criteria

- `isSoloSquad(state)` returns true when exactly one player is in `gameState.players`; `showExtractedLobbyOverlay()` returns early for solo squads so `#abandon-run-btn` stays visible through suspend.
- `renderSuspendedRunBanner()` continues to show `#abandon-run-btn` while `suspendedRunSummary` is present.
- On `RUN_SUSPENDED` and `RUN_ABANDONED` socket events, local `isReady` resets to `false` so Launch Bay ready-up is not blocked after abandon.
- `__AUTOGAME_HARNESS_STATE__()` exposes `abandonRunBtnUsable` (button exists, not `.hidden`, suspended) and `runId` (`gameState.run?.id ?? null`).
- `window.__abandonSuspendedRunForTest()` emits `ABANDON_RUN` when suspended and returns `{ ok: true }` or `{ ok: false, reason }`.
- With sub-ticket **08** capture, iter suspended probe shows `abandonRunBtnUsable === true` and lobby body text includes "Abort Sortie"; `server.log` has no `[run] checkpoint restored` after suspend.
- No regressions to passed sub-tickets 01–03 or 05; `cd game && pnpm test:quick` passes.

## Technical Specs

- Edit: `game/client/main.js` only.
  - Add `isSoloSquad()` near other lobby helpers (~line 520).
  - Guard `showExtractedLobbyOverlay()` (~line 582) with `if (isSoloSquad()) return;`.
  - Reset `isReady = false` in `RUN_SUSPENDED` / `RUN_ABANDONED` handlers (~lines 1830–1850).
  - Extend `__AUTOGAME_HARNESS_STATE__()` (~line 4583): `abandonRunBtnUsable`, `runId`.
  - Add `window.__abandonSuspendedRunForTest` near other `window.__*ForTest` hooks (~line 2070).
- Reference: `game/client/index.html` `#abandon-run-btn` ("Abort Sortie"); `game/server/progression.js` `abandonSuspendedRun()` clears `suspendedCheckpoint`.
- Depends on sub-ticket **08** for correct iter capture (suspend-only, not resume).

## Verification: code
