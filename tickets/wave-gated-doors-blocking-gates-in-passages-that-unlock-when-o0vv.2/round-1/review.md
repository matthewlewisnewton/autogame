# Final Review: Wave-Gated Doors

## Runtime Health

FAIL. The captured run is not clean. `metrics.json` has `"ok": false` with `failure_kind: "capture_failed"`, and `console.log` records `Telepipe run-preservation assertion failed: objective.totalEnemies (6) !== original pre-suspend enemy count (2)`. There are no browser page errors (`pageerrors.json` is empty), and the dev servers did start, so this is not the special harness start-up blocker case.

More importantly, the server log shows repeated game-loop exceptions immediately after telepipe restore:

`TypeError: entered.has is not a function` at `game/server/questDialogue.js:193`, called from `game/server/progression.js:1345`.

The root cause is visible in the live code: `captureCardCheckpoint()` serializes `run._dialogueRoomsEntered` as an array, then `restoreCardCheckpoint()` deep-clones that array back onto `_gameState.run`; `initDialogueState()` only initializes a missing value and does not convert an existing array back to a `Set`. The next room-entry dialogue tick calls `.has()` on the array. This violates the ticket's requirement that telepipe escape still works while gated and blocks a passing verdict regardless of the rest of the implementation.

## Acceptance Criteria

### Locked gate blocks both player movement and enemy pathing

Mostly satisfied in code. The server-side passage locks are integrated into wall colliders, and the focused tests cover authoritative player movement rejection plus enemy `moveEntityToward()` blocking while the lock is active. Client prediction also includes locked passage AABBs through `buildWallColliders(layout, passageLocks)`.

This cannot be marked fully accepted because the captured run is failed, but I did not find a separate movement/pathing defect in the live implementation.

### Clearing the bound wave unlocks within one tick and clients see it disappear

Partially satisfied. `unlockPassagesForWave()` clears matching locks as soon as a scripted wave advances, invokes the passage-locks-changed callback, and rebuilds server colliders. The client reconciles `run.passageLocks`, removes unlocked gate meshes, and plays an unlock effect. Tests cover mesh creation/removal and unlock feedback.

The runtime failure prevents final acceptance. The unlock radio/toast behavior is also tied to quest dialogue state, and that same dialogue state crashes after a telepipe restore.

### Scripted quest can chain room A wave -> room B gate -> treasure gate

Not robustly satisfied as normal gameplay. The chain support is demonstrated by `SCRIPTED_ENCOUNTER_FIXTURE_DEF` and the `passage-lock-chain` debug scenario, but `SCRIPTED_ENCOUNTER_FIXTURE_DEF` is explicitly a test/debug fixture and is not registered in the normal quest list. The shipped `training_caverns` tier only has one passage lock. Because this ticket added a debug scenario, the debug-scenario rule applies: the same end-state must be reachable through normal gameplay, and the two-gate chain is currently only reachable through the debug shortcut.

### No gates in non-scripted quests; telepipe escape still works while gated

The "no gates in non-scripted quests" side is covered by `passage_locks.test.js` for `arena_trials`, and I did not find non-scripted quest lock registration in `QUEST_DEFS`.

The telepipe side fails. The capture used `telepipe-ready` in `training_caverns`, successfully suspended and restored the run, then the server began throwing the room-entry dialogue Set/array exception on every tick. A gated run cannot be considered telepipe-safe until restore rehydrates dialogue state cleanly and the capture is green.

## Design And Requirements

The implementation generally follows the design direction: server-authored passage locks participate in wall collision, client gates are visible and removed with effects, and normal rendering/client connection foundations remain present. However, the failed post-telepipe game loop is a regression against the core server-client requirement that the running game remains connected and synchronized.

The debug chain gap also conflicts with the design intent that quest pacing is a real player-facing flow rather than only a QA fixture.

## Tests And Coverage

`coverage.log` shows the automated suite passed: 142 test files and 2034 tests. Relevant tests include `server/test/passage_locks.test.js`, `server/test/passage_lock_chain.test.js`, `client/test/passage-gate-meshes.test.js`, and `client/test/passage-gate-unlock-feedback.test.js`.

Those tests miss the blocking restored-checkpoint path for quest dialogue state. Coverage visibility is useful, but the live capture is the decisive signal here.

## Remaining gaps

1. Telepipe suspend/resume in a scripted quest restores `_dialogueRoomsEntered` as an array, causing `tickDialogueRoomEntry()` to throw `TypeError: entered.has is not a function` every game-loop tick after resume.
2. The new chained passage-lock debug scenario demonstrates a two-gate chain only through `SCRIPTED_ENCOUNTER_FIXTURE_DEF`, which is not a normal selectable quest; the same chained end-state is not reachable through normal gameplay.

VERDICT: FAIL
