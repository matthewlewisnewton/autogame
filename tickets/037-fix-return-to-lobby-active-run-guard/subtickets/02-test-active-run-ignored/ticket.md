# Integration Test — returnToLobby Ignored During Active Run

Add an integration test that starts a run with two players, emits `returnToLobby` while the run is still `playing`, and verifies that `gameState` is untouched.

## Acceptance Criteria

- A new test exists in `game/server/test/integration.test.js` that:
  - Connects two sockets and starts a run (both players ready up).
  - Confirms `gameState.gamePhase === 'playing'` and `gameState.run.status === 'playing'`.
  - Emits `returnToLobby` from one socket.
  - Verifies `gameState.gamePhase` remains `'playing'`.
  - Verifies `gameState.run` still exists with the same `id` and `status === 'playing'`.
  - Verifies `gameState.enemies` count is unchanged.
- The test passes after the guard fix in sub-ticket 01.

## Technical Specs

- **File**: `game/server/test/integration.test.js`
- Add a new `it('ignores returnToLobby while the run is still playing', ...)` test in the existing `describe` block for run/lobby flow (near the existing return-to-lobby tests around line 659).
- Use the existing `waitForEvent` and `sleep` helpers.
- The test should be placed **before** the existing "returnToLobby resets gamePhase" test so the dependency order is clear.

## Verification: code
