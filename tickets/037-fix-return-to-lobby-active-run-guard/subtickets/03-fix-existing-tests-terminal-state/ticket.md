# Fix Existing Tests That Call returnToLobby on Active Runs

Two existing integration tests in `game/server/test/integration.test.js` call `returnToLobby` immediately after starting a run (while `run.status === 'playing'`). After the guard fix in sub-ticket 01, these tests will hang or fail because `returnPlayersToLobby()` is no longer called. Update both tests to put the run in a terminal state before calling `returnToLobby`.

## Acceptance Criteria

- The test `'returnToLobby resets gamePhase, clears run, empties enemies/minions/loot, and sets players to ready: false'` (around line 659) sets `gameState.run.status = 'victory'` before emitting `returnToLobby`.
- The test `'after returnToLobby, players can ready up and start a second run with a fresh objective'` (around line 703) sets `gameState.run.status = 'victory'` before emitting `returnToLobby` on the first run.
- Both tests continue to verify the same post-lobby-reset assertions as before.
- All tests in `game/server/test/integration.test.js` pass with `npm test -- --coverage.enabled=false`.

## Technical Specs

- **File**: `game/server/test/integration.test.js`
- In the test at ~line 659: after `await waitForEvent(socket1, 'stateUpdate')` and before `socket1.emit('returnToLobby')`, add `gameState.run.status = 'victory';`.
- In the test at ~line 703: after the first run's `await waitForEvent(socket1, 'stateUpdate')` and before `socket1.emit('returnToLobby')`, add `gameState.run.status = 'victory';`.
- Do NOT modify the reward-persistence tests (lines 959, 1005, 1091) — they already drive the run to `runComplete` before calling `returnToLobby`.

## Verification: code
