# Integration Test — Last Player Disconnect Resets to Lobby

Add an integration test in `game/server/test/integration.test.js` that verifies the server resets to lobby state when the sole player disconnects mid-run, and that a new connection receives a clean lobby `init` payload.

## Acceptance Criteria

- A new `it` block connects a single socket, readies up, and transitions to the `playing` phase.
- After asserting `gamePhase === 'playing'`, `gameState.run` exists, and enemies are present, the socket disconnects.
- After disconnect: `gameState.gamePhase === 'lobby'`, `gameState.run` is undefined, `gameState.enemies` is empty.
- A second socket connects and receives `init` with `gamePhase === 'lobby'`.
- The test uses existing helpers (`startTestServer`, `connectClient`, `waitForEvent`) and follows the file's conventions.
- `npm test` passes including this new test.

## Technical Specs

- **File:** `game/server/test/integration.test.js`
- Add a new `describe('Reset state on last disconnect', ...)` block (or add the test to an existing disconnect-related describe block).
- Test name: `'resets to lobby when the last player disconnects during an active run'`
- Use the test snippet from the parent ticket (`tickets/058-reset-state-on-last-disconnect/ticket.md`) as a starting point, adapting to the existing helper functions (`connectClient`, `waitForEvent`, `sleep`).
- Make sure to disconnect the socket in the `afterEach` cleanup to avoid port conflicts.

## Verification: code
