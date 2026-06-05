# 04-test-max-players-cap

Add unit/integration tests to verify the MAX_LOBBY_PLAYERS cap is enforced correctly, including leave/disconnect slot freeing and count accuracy.

## Acceptance Criteria

- Test confirms that `joinLobby` is rejected with `lobbyError` when a lobby has 16 connected players.
- Test confirms that an explicit `leaveLobby` decrements the connected count and allows a 17th player to join the freed slot.
- Test confirms that a disconnected player (ghost, `connected: false`) does not count toward the cap — a new player can join even with 16 connected + 1 ghost.
- Test confirms that after `evictDisconnectedPlayers` removes a ghost, the lobby `playerCount` in `lobbySummary` correctly reflects remaining players.
- Test confirms that `MAX_LOBBY_PLAYERS` constant in `config.js` equals `16`.
- All existing tests continue to pass.

## Technical Specs

- **File:** `game/server/test/lobbies.test.js` (or a new `game/server/test/maxPlayers.test.js`)
  - Create a lobby, simulate 16 players joining (via `joinPlayerToLobby` or socket events), then attempt a 17th join and assert `lobbyError` emission.
  - Simulate one player leaving (`leaveLobbyForSocket` or `removePlayerFromLobby`), then assert a new player can join.
  - Simulate one player disconnecting (set `connected: false`, `disconnectedAt: Date.now()`), then assert a new player can still join (ghost doesn't count).
  - Verify `lobbySummary` playerCount after eviction matches expected remaining players.
  - Simple assertion that `config.MAX_LOBBY_PLAYERS === 16`.

## Verification: code
