# 07 — Expose suspended-run checkpoint in client harness state

The server already emits `runSuspended` and includes `suspendedRunSummary` in `stateUpdate` snapshots, but the client never stores or forwards that summary. Wire the client to consume those payloads and surface them through `window.__AUTOGAME_HARNESS_STATE__()` so the telepipe capture's `stashObjective` / `assertRunPreserved` steps can stash the pre-resume objective.

## Acceptance Criteria

- Client registers a `runSuspended` socket handler that stores the emitted summary in module-level state.
- On every `stateUpdate`, sync `suspendedRunSummary` from the snapshot (`state.suspendedRunSummary`) and clear it when null (e.g. after resume or abandon).
- `window.__AUTOGAME_HARNESS_STATE__()` returns a `suspendedRunSummary` field matching the server shape: `{ questId, questName, objective: { type, totalEnemies, defeatedEnemies, … } }` or `null`.
- When a run is suspended, harness `runStatus` reports `'suspended'` (from `gameState.run.status`) and `phase` is `'lobby'`.
- After telepipe suspend in the harness capture flow, a lobby-phase probe shows non-null `suspendedRunSummary.objective` with the expected `type`, `totalEnemies`, and `defeatedEnemies` (see `game/docs/walkthroughs/telepipe-suspend-resume/state-snapshot.json` → `suspended` block).
- **`game/client/test/main.test.js`**: add unit test(s) that simulate `runSuspended` + `stateUpdate` and assert harness fields.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/client/main.js`**:
  - Add module-level `let suspendedRunSummary = null`.
  - Register `s.on(SERVER_TO_CLIENT.RUN_SUSPENDED, (summary) => { … })` to assign the payload.
  - In the existing `STATE_UPDATE` handler, assign `suspendedRunSummary = state.suspendedRunSummary ?? null` (or derive from checkpoint presence).
  - Extend `window.__AUTOGAME_HARNESS_STATE__()` return object with `suspendedRunSummary` (deep-copy or shallow clone of stored summary).
  - Ensure `runStatus` in harness already reflects `gameState.run.status` — verify it reads `'suspended'` during hub-with-checkpoint phase.
- **`game/client/test/main.test.js`**: harness-state test for suspended summary presence/absence across suspend and clear events.

## Verification: code
