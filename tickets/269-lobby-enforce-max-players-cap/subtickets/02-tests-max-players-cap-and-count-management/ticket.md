# 02-tests-max-players-cap-and-count-management

Add unit/integration tests to verify the MAX_PLAYERS cap is enforced and that player count correctly decrements on both explicit leave and disconnect paths, preventing count drift.

## Acceptance Criteria

- Test: creating a lobby and joining 16 players succeeds; the 17th `joinLobby` emit receives `lobbyError` with reason containing "full"
- Test: after one of 16 players emits `leaveLobby`, a new player can successfully join
- Test: after one of 16 players disconnects (socket disconnect), a new player can successfully join
- Test: player count (`Object.keys(lobby.state.players).length`) never exceeds `MAX_PLAYERS`
- All existing tests continue to pass

## Technical Specs

- **`game/server/test/max_players_cap.test.js`** — New test file with at least 3 test cases:
  1. "rejects join when lobby has MAX_PLAYERS" — connect 16 clients to same lobby, assert 17th gets `lobbyError`
  2. "explicit leave frees slot for new joiner" — fill to 16, one leaves, new client joins successfully
  3. "disconnect frees slot for new joiner" — fill to 16, one disconnects, new client joins successfully
- Use existing test helpers (`connectClient`, `waitForEvent`) from `game/server/test/helpers.js`

## Verification: code
