# Resume re-enters the suspended run from a distinct hub affordance

When a run is suspended, the hub must offer a Resume control that is visually and
functionally distinct from the new-mission Deploy/launch, and using it re-enters the
in-progress (checkpointed) run with magic stones, card charges, and objective progress
preserved. Today the single Deploy button does double duty (it resumes when a checkpoint
exists, otherwise launches fresh), which the ticket wants split apart.

## Acceptance Criteria

- While the squad's run is suspended (lobby phase with a `suspendedRunSummary` /
  `suspendedCheckpoint`), the hub shows a dedicated Resume control that is a separate
  element from the new-mission Deploy button, and the new-mission Deploy button is hidden
  so the two launch paths are unambiguous.
- Activating the Resume control re-enters the suspended run: it triggers the server's
  resume path (`checkAllReady` → `restoreRunCheckpoint` → `startGame`) so the squad returns
  to the same dungeon layout/enemies/loot/portal, not a freshly generated run.
- The existing Abandon control remains available while suspended, and abandoning clears the
  checkpoint and returns to normal lobby flow (new-mission Deploy visible again).
- When NOT suspended (no checkpoint), the Resume control is hidden and the new-mission
  Deploy button behaves as before.
- A server/integration test exercises the full two-player suspend→resume round-trip and
  asserts that across resume: a player's `magicStones` is the spent/preserved value (NOT
  reset to `STARTING_MAGIC_STONES`), a damaged hand card's `remainingCharges` is preserved
  (NOT reset to its full `charges`), and the run `objective` progress
  (collected/defeated counts) is preserved.

## Technical Specs

- `game/client/index.html` (~line 218-220): add a distinct `#resume-run-btn` element near
  the `#suspended-run-banner` / `#ready-btn` / `#abandon-run-btn` cluster.
- `game/client/main.js`:
  - `renderSuspendedRunBanner()` (~line 509) and `setDeployButtonVisible()` (~line 501):
    when suspended, show `#resume-run-btn` and the Abandon button and hide the new-mission
    `#ready-btn`; when not suspended, hide `#resume-run-btn`.
  - Wire `#resume-run-btn`'s click to trigger the resume flow. Reuse the proven all-ready
    server gate by emitting `playerReady(true)` (server routes to resume because
    `suspendedCheckpoint` exists in `checkAllReady`, `game/server/progression.js` ~line
    2989) — do NOT add a parallel fresh-launch path. Keep the new-mission Deploy
    (`readyBtn` handler ~line 3746) for the no-checkpoint case only.
  - Label the Resume control from theme (`THEME.run.resumeSortie`).
- `game/server/test/integration.test.js`: add a test under the Telepipe suspend/resume
  area that places a telepipe, spends magic stones and a card charge, advances objective
  progress, extracts both players to suspend, then resumes via the ready/`checkAllReady`
  path and asserts `magicStones`, the card's `remainingCharges`, and `run.objective`
  counts are preserved (server checkpoint logic in `captureRunCheckpoint` /
  `restoreRunCheckpoint` already supports this; the test locks the behavior in).
- `game/client/style.css`: style `#resume-run-btn` to match the lobby button cluster
  (no new behavior).

## Verification: code
