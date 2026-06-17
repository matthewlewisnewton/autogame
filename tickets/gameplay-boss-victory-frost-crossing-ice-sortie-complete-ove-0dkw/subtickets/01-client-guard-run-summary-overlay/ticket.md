# Client: guard run-summary overlay against lobby-phase STATE_UPDATE after victory

After `runComplete`, a lobby-phase `stateUpdate` must not call `returnToGuildLobby()` in a way that hides `#run-summary-overlay` while the terminal Sortie Complete summary is still meant to be shown. Add a focused client guard and regression test for the frost_crossing victory race identified in the parent ticket.

## Acceptance Criteria

- When `#run-summary-overlay` is visible (Sortie Complete / Signal Lost), `returnToGuildLobby()` does **not** set `runSummaryOverlay.style.display = 'none'`.
- The `STATE_UPDATE` handler does **not** invoke `returnToGuildLobby()` while a terminal run summary is showing (`state.run?.status` is `victory` or `failed`, or `lastRunSummary?.status` is `victory`/`failed`, or `isRunSummaryOverlayVisible()` is true).
- A new client unit test simulates: `showRunSummary({ status: 'victory', ... })` then a synthetic lobby-phase `stateUpdate` with `gamePhase: 'lobby'` and `run: { status: 'victory' }` — overlay stays `display: flex` and `#summary-status` remains `Sortie Complete`.
- Clicking **Return to Hub** (`RETURN_TO_LOBBY` / `returnToLobbyBtn`) still dismisses the overlay and returns to the guild lobby after the player chooses to leave.
- `pnpm test:quick` passes for the touched client tests.

## Technical Specs

- **Edit:** `game/client/socketHandlers/stateHandlers.js` — gate the `state.gamePhase === 'lobby'` branch so terminal run summaries are not clobbered by transient or stale lobby snapshots.
- **Edit:** `game/client/main.js` — in `returnToGuildLobby()`, skip hiding `#run-summary-overlay` when a terminal summary is active; prefer checking `isRunSummaryOverlayVisible()`, `lastRunSummary`, and/or `state.run?.status` before muting the overlay.
- **Add:** `game/client/test/run-summary-lobby-race.test.js` (or extend `run-summary-input-lock.test.js`) — drive `showRunSummary` then invoke the extracted `STATE_UPDATE` handler with a lobby-phase payload; assert overlay visibility and harness `sortieCompleteOverlayVisible` probe.

## Verification: code
