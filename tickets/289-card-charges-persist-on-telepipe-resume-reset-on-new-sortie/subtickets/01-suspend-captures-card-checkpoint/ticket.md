# 01 — Suspend captures card-state checkpoint on telepipe extract

When the last active player evacuates through the telepipe and `suspendRunToLobby()` runs, persist a minimal `suspendedCheckpoint` containing the in-progress run id and each player's hand/deck card usage (`remainingCharges`, deck order, desperation draw state) before clearing lobby hands. HP and magic stones stay on the player object and are not part of the checkpoint blob.

## Acceptance Criteria

- `game/server/game-state.js` seeds `suspendedCheckpoint: null` on new lobby state.
- After full-squad telepipe extract (`maybeSuspendRun` → `suspendRunToLobby`), `_gameState.suspendedCheckpoint` is non-null and includes the pre-suspend `run.id`.
- Checkpoint `playerStates` preserve each player's `hand`, `deck`, `inDesperation`, `nextDrawAt`, and `desperationDeck` with spent `remainingCharges` intact (deep-copied, not references to cleared arrays).
- Player HP and magic stones are unchanged across suspend (no regression vs current 287 behavior).
- Server emits `runSuspended` and `stateSnapshot()` exposes a `suspendedRunSummary` (quest name + objective summary) while the checkpoint exists.
- Server logs `[run] checkpoint captured` on suspend.
- Existing unit test `telepipe extract returns squad to hub with cleared world and no checkpoint` is updated to expect a captured checkpoint (not `undefined` suspendedRunSummary).

## Technical Specs

- **`game/server/game-state.js`**: add `suspendedCheckpoint: null` to `createGameState()`.
- **`game/server/progression.js`**:
  - Add `captureCardCheckpoint()` that deep-copies run metadata (`id`, `questId`, `questTier`, `questName`, `objective`, `status`, `startedAt`, encounter if present) and per-player card snapshots from live player objects.
  - Call `captureCardCheckpoint()` at the start of `suspendRunToLobby()` (before `resetTransientRunState` / hand clearing).
  - Add `buildSuspendedRunSummary(checkpoint)` helper; include result in `buildWorldSnapshot()` / `stateSnapshot()` as `suspendedRunSummary`.
  - Emit `SERVER_TO_CLIENT.RUN_SUSPENDED` with the summary after suspend (import from `shared/events.js`).
- **`game/server/test/server.test.js`**: update the telepipe-extract checkpoint assertion in the `telepipe extract hub return` describe block.

## Verification: code
