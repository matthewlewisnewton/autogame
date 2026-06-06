# Remove checkpoint suspend/resume machinery and client UI

Delete the obsolete `captureRunCheckpoint` / `restoreRunCheckpoint` / `abandonSuspendedRun` / `suspendedCheckpoint` stack and the client “resume expedition” / abandon-checkpoint UX. Telepipe hub pause is handled entirely by in-memory run state (sub-ticket 02).

## Acceptance Criteria

- `captureRunCheckpoint`, `restoreRunCheckpoint`, `capturePlayerCombatState`, `abandonSuspendedRun`, and `clearSuspendedRunData` checkpoint usage are removed from `progression.js` exports and call sites.
- `gameState.suspendedCheckpoint` is removed from initial state (`game-state.js`) and all server references.
- `buildSuspendedRunSummary` / `suspendedRunSummary` in snapshots and `RUN_SUSPENDED` resume-banner payload are removed or replaced with a minimal “run paused” signal that does not imply checkpoint restore.
- Client `renderSuspendedRunBanner`, `#abandon-run-btn` checkpoint abandon flow, and `ABANDON_RUN` handler for suspended checkpoints are removed or no-op without breaking hub deploy.
- `game/client/scripts/test-telepipe-suspend-resume.mjs` is updated or deleted so it no longer tests checkpoint restore.
- All server tests referencing checkpoint capture/restore/abandon are updated or removed; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`** — delete checkpoint functions; simplify `suspendRunToLobby` emit payload; remove `abandonSuspendedRun`.
- **`game/server/index.js`** — drop checkpoint exports/wiring.
- **`game/server/socketHandlers/runHandlers.js`** — remove `abandonSuspendedRun` handler branch.
- **`game/server/socketHandlers/lobbyHandlers.js`** — remove `suspendedCheckpoint` guards if any.
- **`game/server/debugScenarios.js`** — update telepipe suspend scenarios that call removed APIs.
- **`game/shared/events.json`** — remove or repurpose `RUN_SUSPENDED` / `ABANDON_RUN` only if no longer emitted; keep events stable if other code still listens.
- **`game/client/main.js`** — remove suspended-run banner, abandon button wiring, `suspendedRunSummary` client state.
- **Tests:** `game/server/test/server.test.js`, `integration.test.js`, `encounters.test.js`, `debug-scenarios.test.js`, and any file importing checkpoint helpers.

## Verification: code
