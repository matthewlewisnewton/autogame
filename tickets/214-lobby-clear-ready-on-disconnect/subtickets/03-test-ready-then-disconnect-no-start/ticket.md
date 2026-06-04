# Test ready-then-disconnect does not start run

Add an automated regression test that reproduces the bug: a player readies up, soft-disconnects, and the lobby must not emit `startGame` or enter the playing phase while a remaining connected player is not ready.

## Acceptance Criteria

- New test in `game/server/test/integration.test.js` (add a `describe` block or extend `Socket Integration — Disconnect Event` / `Lobby / playerReady Flow`).
- Scenario: two clients in the same lobby; player A emits `playerReady(true)`; player A disconnects socket; after a short wait, `gamePhase` for that lobby remains `lobby` and player B does not receive `startGame`.
- Assert player A's lobby record has `connected === false` and `ready === false` after disconnect.
- Test passes with `pnpm test:quick` (or the server's vitest target that includes `integration.test.js`).

## Technical Specs

- **File:** `game/server/test/integration.test.js`
- Reuse existing helpers: `startTestServer`, `connectTwoClients`, `lobbyGameState`, `waitForEvent`, `sleep`, `closeServer`.
- Flow:
  1. `connectTwoClients(baseUrl)` → two sockets, shared `lobbyId`.
  2. `socket1.emit('playerReady', true)`.
  3. `socket1.disconnect()`; `await sleep(100)` (match other disconnect tests).
  4. `expect(lobbyGameState(lobbyId).gamePhase).toBe('lobby')`.
  5. `expect(lobbyGameState(lobbyId).players[socket1._playerId].ready).toBe(false)`.
  6. Optionally use a timeout-wrapped `waitForEvent(socket2, 'startGame')` that must **not** fire within ~500ms, or assert no `startGame` listener fired.
- Clean up: disconnect `socket2` in test teardown consistent with neighboring tests.

## Verification: code
