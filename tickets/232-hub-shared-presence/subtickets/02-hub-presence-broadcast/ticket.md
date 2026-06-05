# Broadcast hub presence updates to the lobby room

Emit a dedicated `hubPresenceUpdate` socket event scoped to each lobby's Socket.IO room during the lobby phase. Broadcast on the game-loop tick (after presence sync) and immediately on join/leave so party-mates receive timely roster and position updates without relying on ad-hoc full `stateUpdate` shape for hub avatars.

Depends on sub-ticket 01 (`hubPresence` state + sync helpers).

## Acceptance Criteria

- During `gamePhase === 'lobby'`, each game-loop tick emits `hubPresenceUpdate` to `io.to(lobby.id)` with the payload from `buildHubPresencePayload(lobby, /* viewer */ null)` (same payload to all sockets for now; per-socket filtering is reserved for later).
- Payload shape: `{ lobbyId, revision, players }` where each `players[id]` includes `x`, `y`, `z`, `rotation`, `cosmetic`, and `username`.
- No `hubPresenceUpdate` is emitted while `gamePhase === 'playing'` (dungeon run uses existing `stateUpdate`).
- When a player joins a lobby in the lobby phase, every socket already in `lobby.id` receives a `hubPresenceUpdate` that includes the new member (not only on the next tick).
- When a player leaves (or is removed from) a lobby in the lobby phase, remaining members receive a `hubPresenceUpdate` whose `players` map no longer contains the departed id.
- Broadcasts are per-lobby (`io.to(lobby.id)`); there is no global `io.emit` for hub presence.
- Server integration tests with two connected clients in the same lobby assert: (a) join adds the second player to the payload received by the first client, (b) leave removes them, (c) after one client emits `move` and a tick elapses, the other client's `hubPresenceUpdate` reflects the new position.

## Technical Specs

- `game/server/hubPresence.js`:
  - Add `broadcastHubPresence(io, lobby)` that reads `lobby.hubPresence`, builds the payload, and emits `hubPresenceUpdate` to `io.to(lobby.id)`.
  - Keep `buildHubPresencePayload(lobby, viewerPlayerId)` as the single assembly point so future per-viewer emits can loop sockets and pass each `viewerPlayerId`.
- `game/server/index.js`:
  - In `runGameLoopTick`, after lobby-phase movement + presence sync (sub-ticket 01), call `broadcastHubPresence` instead of relying on tick `stateUpdate` for hub avatar positions.
  - In `joinPlayerToLobby` (after sync), call `broadcastHubPresence` when `isLobbyPhase(state)`.
  - In `leaveLobbyForSocket` / `notifyPlayerRemoved` lobby-phase path (after `removeHubPresencePlayer`), call `broadcastHubPresence` for non-deleted lobbies.
- `game/server/test/hub_presence_broadcast.test.js` (new):
  - Use `startTestServer`, `connectClient`, and `waitForEvent` helpers from `server/test/helpers.js`.
  - Two-client join/leave and lobby-phase move scenarios described in the acceptance criteria.

## Verification: code
