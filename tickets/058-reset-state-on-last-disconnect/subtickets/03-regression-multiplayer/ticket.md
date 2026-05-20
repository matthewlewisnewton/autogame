# Regression Test — Disconnecting One Player Does Not Reset Run

Add an integration test confirming that when one of multiple connected players disconnects during an active run, the server does **not** reset to lobby. The remaining player should continue with `gamePhase === 'playing'` and the run state intact.

This guards against the edge case where the zero-player check in sub-ticket 01 accidentally triggers when players remain.

## Acceptance Criteria

- Two sockets connect, both ready up, and the game transitions to `playing`.
- One socket disconnects.
- After disconnect: `gameState.gamePhase` remains `'playing'`, `gameState.run` still exists, and at least one enemy remains.
- The remaining socket still sees the player in `gameState.players`.
- `npm test` passes including this new test.

## Technical Specs

- **File:** `game/server/test/integration.test.js`
- Add a new test within the same `describe('Reset state on last disconnect', ...)` block created in sub-ticket 02.
- Test name: `'does not reset run when one of multiple players disconnects'`
- Connect two clients (`socket1`, `socket2`), ready both, wait for `startGame`.
- Disconnect `socket1`, await a tick, assert that `gamePhase` is still `'playing'` and `gameState.run` is defined.
- Clean up `socket2` in `afterEach`.

## Verification: code
