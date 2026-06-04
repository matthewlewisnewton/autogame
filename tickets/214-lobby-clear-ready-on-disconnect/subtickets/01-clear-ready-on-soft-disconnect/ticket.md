# Clear ready on soft disconnect

When a player soft-disconnects from a lobby, their `ready` flag must be cleared at the same time as `connected` is set to false so lobby UI and deploy logic do not treat them as still ready.

## Acceptance Criteria

- In `softDisconnectPlayerFromLobby` (`game/server/index.js`), set `player.ready = false` in the same `withLobbyContext` block where `player.connected = false` is assigned.
- After a soft disconnect, `lobby.state.players[playerId].ready` is `false` for that player (verified via socket integration test or direct state inspection).
- Existing disconnect grace-period behavior is unchanged: the player record remains in the lobby with `connected === false`.

## Technical Specs

- **File:** `game/server/index.js`
- **Function:** `softDisconnectPlayerFromLobby` (around lines 874–904)
- Add `player.ready = false` immediately after setting `player.connected = false` (and related input/disconnect fields). No other handler changes in this sub-ticket.
- `broadcastLobbyUpdate(lobby)` already runs in the lobby-phase branch; no extra broadcast wiring required.

## Verification: code
