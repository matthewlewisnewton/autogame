# 03 — New sortie resets card charges (no checkpoint / abandon)

A deploy that is **not** resuming a suspended checkpoint is a new sortie: the server must build a fresh draw deck and opening hand (full `remainingCharges`), while still preserving durable `hp` and `magicStones`. Players must be able to discard a suspended checkpoint (abort sortie) to start a new sortie intentionally.

## Acceptance Criteria

- `checkAllReadyInner()` fresh-deploy path (no `suspendedCheckpoint`) still calls `createDrawDeckFromSelectedDeck()` + `initPlayerHand()` so every occupied hand slot has `remainingCharges === charges`.
- `abandonSuspendedRun()` clears `suspendedCheckpoint`, deletes any stale run reference, resets ready flags, and emits `runAbandoned` + `stateUpdate`.
- `abandonRun` socket handler is wired (e.g. in `game/server/socketHandlers/runHandlers.js`) and only succeeds while `suspendedCheckpoint` is set and `gamePhase === 'lobby'`.
- After telepipe suspend → `abandonSuspendedRun()` → ready deploy: `run.id` is **new** (differs from the abandoned checkpoint run id) and card charges are fully reset.
- Fresh deploy after abandon still preserves player `hp` and `magicStones` (regression guard for 287).
- `selectQuest` remains blocked (or no-ops with error) while `suspendedCheckpoint` is set, so quest changes cannot accidentally resume with stale card state.

## Technical Specs

- **`game/server/progression.js`**: implement `abandonSuspendedRun()`; export it; ensure terminal run cleanup (`returnPlayersToLobby`, victory/fail) also clears any stale `suspendedCheckpoint`.
- **`game/server/socketHandlers/runHandlers.js`**: register `CLIENT_TO_SERVER.ABANDON_RUN` → `abandonSuspendedRun()` with lobby context guard.
- **`game/server/index.js`**: pass `abandonSuspendedRun` into socket handler ctx if required by extraction pattern.
- **`game/server/socketHandlers/`** (quest handler): guard `selectQuest` when `suspendedCheckpoint` is non-null (match prior tier-2 policy).
- **`game/server/test/server.test.js`**: add test `new sortie after abandon resets card charges but preserves hp and magicStones` covering suspend → abandon → deploy.

## Verification: code
