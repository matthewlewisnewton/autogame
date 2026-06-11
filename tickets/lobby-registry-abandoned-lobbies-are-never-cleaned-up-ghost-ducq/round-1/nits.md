## Redundant trade cancellation in reapAbandonedLobbies

In `game/server/index.js`, `reapAbandonedLobbies()` calls
`cancelTradesForPlayer(lobby.state.pendingTrades, playerId)` for each player and
then immediately calls `lobbies.removePlayerFromLobby(playerId)`, which already
clears that player's pending trades. The explicit call is harmless but dead work.

### Acceptance Criteria
- The per-player trade cleanup in the reaper relies on `removePlayerFromLobby`
  (or keeps only `savePlayerData`) without a redundant `cancelTradesForPlayer`
  call, and existing reap/integration tests still pass.
