# Purge hub presence when players leave during a run

Players who leave while `gamePhase === 'playing'` must not remain in `lobby.hubPresence.players`, so they cannot reappear as ghost hub avatars after the squad returns to lobby phase.

## Acceptance Criteria

- `leaveLobbyForSocket` and disconnected-player eviction call `removeHubPresencePlayer(lobby, playerId)` whenever a member is removed from the lobby, regardless of `gamePhase` (remove the `wasLobbyPhase` guard around deletion only; `broadcastHubPresence` stays gated to lobby phase).
- `buildHubPresenceUpdate` omits any `hubPresence.players` entry whose id is absent from `lobby.state.players` (defense in depth if a stale key slips through).
- `syncHubPresenceFromLobbyState` prunes registry keys that are no longer in `lobby.state.players` after upserting connected members (so returning to lobby phase cannot resurrect removed ids).
- Unit test in `hub_presence.test.js`: stale registry entry with no matching `state.players` id is excluded from `buildHubPresenceUpdate` output.
- Integration test in `hub_presence.integration.test.js`: two clients join lobby and see each other in `hubPresenceUpdate`; both ready and `startGame`; leaver calls `leaveLobby` during playing; squad returns to lobby phase (`returnToLobby` after run is terminal, or equivalent harness path); remaining client’s next `hubPresenceUpdate` does not include the leaver’s id.

## Technical Specs

- **`game/server/index.js`**
  - In `leaveLobbyForSocket`, always call `removeHubPresencePlayer(lobby, playerId)` before `removePlayerFromLobby`; keep `broadcastHubPresence(lobby)` behind `isLobbyPhase(lobby.state)` after removal.
  - In the disconnect-eviction loop (`evictDisconnectedPlayers` / grace-timeout path ~lines 1051–1075), same pattern: always remove hub presence on eviction; broadcast only when lobby phase.
- **`game/server/hubPresence.js`**
  - In `buildHubPresenceUpdate`, `continue` when `!lobby.state?.players?.[id]` (in addition to existing `connected === false` skip).
  - In `syncHubPresenceFromLobbyState`, after upserting connected members, delete any `lobby.hubPresence.players` key not present in `lobby.state.players`.
- **`game/server/test/hub_presence.test.js`**
  - Add case: manually set `hubPresence.players.ghost` without a `state.players.ghost`; assert `buildHubPresenceUpdate` payload has no `ghost` key.
- **`game/server/test/hub_presence.integration.test.js`**
  - Add `mid-run leave does not ghost in hub presence after return to lobby`: follow existing helpers (`connectWithUsername`, `waitForHubPresenceWithPlayer`, `waitForEvent`); complete or terminalize run so `returnToLobby` succeeds; assert leaver absent from peer presence payload.

## Verification: code
