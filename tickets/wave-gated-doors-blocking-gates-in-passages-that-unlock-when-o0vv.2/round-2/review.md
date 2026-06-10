# Senior Review: Wave-Gated Passage Doors

## Per-Criterion Findings

### Runtime Health

Fail. The round-2 captured run is not clean: `metrics.json` has `"ok": false` and `failure_kind: "capture_failed"`. Servers did start and `pageerrors.json` is empty, but `console.log` contains:

`[capture:error] Telepipe run-preservation assertion failed: objective.totalEnemies (6) !== original pre-suspend enemy count (2)`

The capture plan was the fallback `telepipe-ready` flow, not a gate-specific visual capture, and the round-2 folder contains no `.png` screenshots despite the screenshot plan entries. Under the ticket review rules, a non-ok captured run is an automatic fail regardless of code appearance.

### A Locked Gate Blocks Player Movement And Enemy Pathing

Partially satisfied, but blocked by a red ticket test. The implementation adds locked-passage AABBs to server wall colliders and mirrors that math on the client. The tests cover static wall collision, authoritative player movement rejection while locked, and enemy `moveEntityToward` blocking.

However, the coverage run reports `server/test/passage_locks.test.js > rejects server movement through a locked passage` failed after unlock:

`AssertionError: expected 13.200000000000003 to be less than 10`

This is directly tied to the authoritative player movement criterion. The tree cannot pass while its own movement regression test for this feature is red.

### Clearing The Bound Wave Unlocks Within One Tick And Clients See It Disappear

Mostly implemented in code. `onScriptedEnemyDefeated()` advances scripted waves immediately after enemy cleanup, `unlockPassagesForWave()` flips matching `passageLocks` and invokes the collider rebuild callback, and the client sync removes the gate mesh with a one-time unlock VFX. The focused client tests for gate mesh removal and unlock feedback pass in the coverage log.

This criterion is still not proven by the browser capture because the fallback telepipe run failed before a gated-wave flow was captured.

### A Scripted Quest Can Chain Room A Wave -> Room B Gate -> Treasure Room

Implemented in live code. `training_caverns` tier 1 now has two scripted passage locks: room 0 wave 0 unlocks the first passage, and room 1 wave 0 unlocks the second passage. `server/test/passage_lock_chain.test.js` validates the A -> B -> end-room chain and passes in coverage.

### No Gates In Non-Scripted Quests; Telepipe Escape Still Works While Gated

Non-scripted quests are covered by `server/test/passage_locks.test.js`, which asserts `arena_trials` deploys without `passageLocks`.

Telepipe compatibility remains blocking because the captured proof failed during telepipe suspend/resume on the newly scripted `training_caverns` objective. The probes show the enemy IDs were preserved across resume, but the capture failed because the run objective reported the full authored scripted total (`6`) while the pre-suspend live enemy count was only the current active wave (`2`). The next pass needs to make the scripted-gated telepipe capture/probe contract consistent and green.

### Debug Scenarios

The new `passage-lock-chain` scenario is gated behind the existing debug-scenario socket/URL path and uses the normal quest deploy/start-run helpers with a deterministic seed. Its end state is reachable through normal gameplay by selecting Initiate Vault and deploying, so the new shortcut itself does not appear to replace the normal flow.

There is still a blocking debug regression in the changed `game/server/debugScenarios.js` area: coverage reports `server/test/debug-scenarios.test.js > arena-trials harness combat shortcuts > places player outside dormant arena_champion trigger after adds cleared` failed because `approachResult.ok` was false.

### Design And Foundation Consistency

The intended design direction matches `game/docs/design.md`: Initiate Vault is now a scripted annex sweep with passage locks and dialogue beats, and the work does not obviously regress the foundation requirements for rendering, socket connection, player visualization, or movement synchronization. The current failures are runtime validation/test failures, not a mismatch with the design goal.

## Remaining gaps

1. The round-2 browser capture failed with `metrics.json` `"ok": false`: `Telepipe run-preservation assertion failed: objective.totalEnemies (6) !== original pre-suspend enemy count (2)`.
2. The ticket-specific authoritative movement regression test is red: `server/test/passage_locks.test.js > rejects server movement through a locked passage`.
3. A debug-scenario regression is red in coverage: `server/test/debug-scenarios.test.js > arena-trials harness combat shortcuts > places player outside dormant arena_champion trigger after adds cleared`.

VERDICT: FAIL
