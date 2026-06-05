# Show the dedicated #resume-run-btn as a distinct resume affordance while suspended

The suspended hub still has no visible resume entry point that is distinct from the
new-mission Deploy: `#resume-run-btn` exists in the DOM but is always force-hidden,
and `#ready-btn` is relabeled/restyled to double as the resume control. This closes
that gap by making `#resume-run-btn` the dedicated, visible, distinct resume affordance
during suspension (wired to the existing checkpoint-restore path), while the new-mission
fresh-launch role is removed from the lobby during suspension.

## Acceptance Criteria

- While the squad's run is suspended (lobby phase with `suspendedRunSummary`, i.e.
  `isRunSuspended()` is true), `#resume-run-btn` is VISIBLE (its `hidden` class is
  removed) and is a separate DOM element from `#ready-btn`. It is labeled from theme
  (`THEME.run.resumeSortie` / `THEME.run.resumeReady`) and is the primary, distinct
  resume affordance shown to the player.
- Clicking `#resume-run-btn` re-enters the suspended run through the existing resume
  path: it emits `playerReady(true)` (which the server's `checkAllReady` gate routes to
  `restoreRunCheckpoint` → `startGame` because a `suspendedCheckpoint` exists), and it
  keeps the shared `isReady` flag consistent with the `#ready-btn` handler (so the two
  controls cannot desync). It does NOT add a parallel fresh-launch code path.
- No new-mission fresh-launch is available while suspended: during suspension the lobby
  presents NO control that starts a freshly-generated run (the fresh-start Deploy role is
  removed/disabled). `#ready-btn` must remain VISIBLE and wired to the resume path during
  suspension (the immutable harness telepipe capture's `readyAll` clicks `#ready-btn` to
  resume — see the already-passed sub-ticket 04), but during suspension it carries the
  resume label/`.resuming` styling, NOT the `THEME.lobby.deploy` new-mission label.
- The Abandon control (`#abandon-run-btn`) remains visible while suspended, and abandoning
  clears the checkpoint and returns to normal lobby flow.
- When NOT suspended (no `suspendedRunSummary`): `#resume-run-btn` is hidden, and
  `#ready-btn` behaves exactly as before — it shows `THEME.lobby.deploy` /
  `THEME.lobby.deployReady`, has no `.resuming` class, and launches a fresh run.

## Technical Specs

- `game/client/main.js`:
  - `setDeployButtonVisible()` (~525) and `renderSuspendedRunBanner()` (~543): when
    `isRunSuspended()`, remove the `hidden` class from `#resume-run-btn` (it currently does
    `resumeRunBtn.classList.add('hidden')` unconditionally in both — flip that to SHOW it
    while suspended and hide it otherwise). Keep `#ready-btn` visible+enabled during
    suspension (do NOT regress sub-ticket 04's harness-capture requirement).
  - Add a click handler for `resumeRunBtn` (near the existing `readyBtn` handler ~3808 and
    replacing the "superseded / stays hidden" comment block ~4151-4154): on click, set
    `isReady = true`, `socket.emit('playerReady', true)`, then `syncReadyButtonRole()`.
    Reuse the same emit the `#ready-btn` handler uses — do NOT invent a separate resume
    socket event.
  - `syncReadyButtonRole()` (~514) already labels `#ready-btn` with the resume strings and
    toggles `.resuming` while suspended — keep that. Apply the same theme label to
    `#resume-run-btn` so it reads "Resume sortie"/"Resume!" rather than the static HTML text.
- `game/client/style.css`: give `#resume-run-btn` a distinct, prominent style (it already
  has a `#resume-run-btn` block ~956) so it reads as a separate dedicated control from
  `#ready-btn`; ensure it is not display:none when the `hidden` class is absent. No new
  behavior beyond styling.
- `game/client/index.html` (~219): `#resume-run-btn` already exists in the lobby button
  cluster — no structural change needed beyond what the JS toggles.
- Do NOT modify `harness/` (the capture recipe is fixed and clicks `#ready-btn`). Do NOT
  change the server checkpoint/suspend/restore logic (`captureRunCheckpoint` /
  `restoreRunCheckpoint` / the `checkAllReady` resume gate) — state preservation is already
  locked by sub-ticket 02's integration test and must not regress.

## Verification: code
