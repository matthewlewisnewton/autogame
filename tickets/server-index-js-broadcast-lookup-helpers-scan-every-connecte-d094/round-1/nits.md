## resetGameState clears playerSockets without re-registering live sockets

`resetGameState()` calls `playerSockets.clear()` but does not re-register any currently-connected sockets. Correctness is preserved because `findSocketByPlayerId` falls back to a linear scan when the Map misses, but after a reset every lookup silently degrades to O(n) until each player reconnects. Since `resetGameState` is primarily a reset/test path this is low impact, but rebuilding the Map from `io.sockets.sockets` (or from `activeState.players`) after the clear would keep the optimization intact.

### Acceptance Criteria
- After `resetGameState()` with live connected sockets, `findSocketByPlayerId(playerId)` resolves via the `playerSockets` Map (not the linear-scan fallback) for each still-connected player.
- Existing server tests still pass.

## broadcastLobbyUpdate active-game branch does not reuse the room helper

The per-lobby branch of `broadcastLobbyUpdate` uses `forEachSocketInLobby`, but the active-game branch iterates `Object.keys(activeState.players)` and calls `findSocketByPlayerId` per player. Both are O(1)-ish now, but the two branches use different iteration patterns for the same "emit to everyone in this lobby" intent, which is mildly inconsistent and easy to diverge later. Consider unifying on a single helper where the membership semantics allow.

### Acceptance Criteria
- Both branches of `broadcastLobbyUpdate` deliver `LOBBY_UPDATE` to exactly the same recipients as today.
- The two branches share a single iteration helper, or a short comment documents why the active-game branch must iterate `activeState.players` instead of the lobby room.
- Existing server tests still pass.
