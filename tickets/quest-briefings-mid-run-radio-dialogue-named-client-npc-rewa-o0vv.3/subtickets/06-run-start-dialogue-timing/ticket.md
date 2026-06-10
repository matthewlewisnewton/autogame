# 06 — Run-start dialogue delivery after playing phase

`run_start` quest dialogue is emitted inside `startDungeonRun()` before `START_GAME` and before clients receive a `playing` `STATE_UPDATE`, but `handleQuestDialogue()` ignores events unless `gamePhase === 'playing'`. Normal deploys therefore drop the opening radio line. Reorder delivery so every squad member sees the run-start beat once they are in the dungeon.

## Acceptance Criteria

- On a normal ready-up deploy (`checkAllReady` path), `QUEST_DIALOGUE` with `trigger: 'run_start'` is emitted **after** the client can be in `gamePhase === 'playing'` (i.e. after `START_GAME` and the first playing `STATE_UPDATE`, or via an equivalent client queue flushed on `enteringPlaying`).
- The `quest-comms-run-start` debug scenario and `enterPlayingPhase` deploy path also deliver the run-start line (not only `checkAllReady`).
- `handleQuestDialogue` (or a small pre-playing queue) results in the run-start line appearing in `#quest-comms-log` during an in-run deploy; the line is not silently discarded.
- `run_start` still fires exactly once per run (existing dedupe in `questDialogue.js` unchanged).
- `cd game && pnpm test:quick` passes; server and/or client tests assert deploy ordering (dialogue emit after playing transition, or queued-then-flushed behavior).

## Technical Specs

- **`game/server/progression.js`** — Remove `fireQuestDialogue(io, _gameState, 'run_start')` from `startDungeonRun()`. Add a helper (e.g. `emitRunStartDialogue(io)`) and call it at the end of deploy completion **after** `emitLobbyDeploy(..., START_GAME)` and `emitLobbyDeploy(..., STATE_UPDATE, stateSnapshot())` in `checkAllReadyInner`.
- **`game/server/index.js`** — In `enterPlayingPhase`, emit `STATE_UPDATE` (if not already) and call the same run-start helper after `START_GAME` so debug/harness deploys match production ordering.
- **`game/client/main.js`** (only if server reordering is insufficient across all paths) — Queue `QUEST_DIALOGUE` payloads received while `gamePhase !== 'playing'` and flush them in the existing `enteringPlaying` branch of the `STATE_UPDATE` handler before returning to ignore.
- **`game/server/test/questDialogue.test.js`** — Update/add test proving run-start is emitted only after playing phase is set (mock `gamePhase` + emit order), or integration test via deploy callback sequence.
- **`game/client/test/questDialogue.test.js`** — If client queue is used, assert a pre-playing payload is shown after `gamePhase` becomes `playing`.

## Verification: code
