# 02-server-reject-full-lobby

Enforce the `MAX_LOBBY_PLAYERS` cap on the server: reject `joinLobby` (both normal join and drop-in) when a lobby already has 16 connected players, emitting a `lobbyError` with reason `"Lobby is full"`.

Only **connected** players count toward the cap (ghosts with `connected: false` do not block new joins — they will be evicted by the stale cleanup timer).

## Acceptance Criteria

- Joining a lobby with 16 or more connected players emits `lobbyError` with reason containing "full" to the joining socket.
- The full-lobby check is applied for **both** the lobby-phase join path and the drop-in (playing-phase) path inside `joinLobbyWithPhasePolicy`.
- Only players with `connected === true` count toward the cap; disconnected ghosts (`connected: false`) do not block new joins.
- Explicit leave (`leaveLobby`) still works — player is removed from `state.players`, count decrements, new player can join the freed slot.
- Disconnect path: ghost player (`connected: false`) does not count toward cap, so a new player can join even while the ghost is still in the lobby (before eviction).
- After a ghost is evicted by `evictDisconnectedPlayers`, the lobby player count correctly reflects remaining players.

## Technical Specs

- **File:** `game/server/index.js`
  - Import `MAX_LOBBY_PLAYERS` from `config.js`.
  - In the `joinLobby` handler (around line 1201), after the "Lobby not found" check and before calling `joinLobbyWithPhasePolicy`, add a capacity check:
    ```js
    const connectedCount = Object.values(lobby.state.players).filter(p => p.connected).length;
    if (connectedCount >= MAX_LOBBY_PLAYERS) {
      socket.emit('lobbyError', { reason: 'Lobby is full' });
      return;
    }
    ```
  - Alternatively, place the check inside `joinLobbyWithPhasePolicy` so it covers both lobby-phase and drop-in paths before `joinPlayerToLobby` is called.
- **No changes needed** to `leaveLobby` or `disconnect` — existing `removePlayerFromLobby` already deletes from `state.players`, and ghosts already have `connected: false`.

## Verification: code
