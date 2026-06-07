# 04 — Remove client suspend/resume UI

Remove client UI and socket handling for the deleted checkpoint suspend/resume flow. The hub after telepipe-up should look like a normal lobby (Deploy ready) with no "resume expedition" banner or abandon-checkpoint button.

## Acceptance Criteria

- `renderSuspendedRunBanner` and its call sites are removed; no DOM branch keys off `suspendedRunSummary` or `suspendedCheckpoint`.
- `#abandon-run-btn` is hidden/removed and no longer emits `ABANDON_RUN`.
- `runSuspended` socket listener and any resume-specific copy in the Deploy/quest UI are removed.
- `renderGuildMedic` and HP/MS HUD still reflect server `stateUpdate` values after telepipe-up (no client-side reset of vitals).
- Client tests that referenced suspend banner or abandon button are updated or removed.

## Technical Specs

- **`game/client/main.js`** — Remove `renderSuspendedRunBanner`, `runSuspended` handler, abandon-run wiring, and `suspendedRunSummary` conditionals in lobby render paths.
- **`game/client/index.html`** — Remove or permanently hide `#abandon-run-btn` if unused.
- **`game/client/style.css`** — Remove dead `#abandon-run-btn` / suspended-banner styles if no longer referenced.
- **`game/client/questBoard.js`** — Remove any suspended-run read-only quest logic if present.
- **`game/client/test/*.test.js`** — Update tests that assert suspend UI elements.
- **`game/client/scripts/test-telepipe-suspend-resume.mjs`** — Update or retire if it asserts checkpoint resume (out of scope for visual QA; adjust expectations to hub-return + redeploy).

## Verification: code
