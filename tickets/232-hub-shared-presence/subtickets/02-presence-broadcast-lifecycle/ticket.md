# Broadcast hub presence on join, leave, and lobby ticks

Wire the hub-presence module into lobby membership and the game loop so party-mates receive `hubPresenceUpdate` events scoped to their lobby room, with immediate updates on join/leave/disconnect and periodic updates while players walk the hub.

## Acceptance Criteria

- When a player joins or reconnects to a lobby in `gamePhase === 'lobby'`, their record is synced into `lobby.hubPresence` and all other members in that lobby receive a `hubPresenceUpdate` before the next tick.
- When a player leaves voluntarily (`leaveLobby`), is soft-disconnected past grace, or is evicted, they are removed from `lobby.hubPresence` and remaining members receive an updated `hubPresenceUpdate` without that player.
- During lobby phase, after `applyPlayerMovement` each tick, presence entries are refreshed from `lobby.state.players` and `hubPresenceUpdate` is emitted to the lobby Socket.IO room.
- Broadcast is per-lobby (`io.to(lobby.id)`) — never a global `io.emit`. Each recipient gets a payload from `buildHubPresenceUpdate(lobby, viewerPlayerId)` so per-viewer culling can be added later without changing the event name.
- `hubPresenceUpdate` is not emitted during `gamePhase === 'playing'` (dungeon runs keep using existing `stateUpdate` multiplayer sync).
- Integration tests (two socket clients, same lobby, lobby phase): (a) second join adds peer with cosmetic to presence payload received by first client; (b) first client emits `move`, waits for tick, second client's payload shows changed `x`/`z`; (c) leaver disappears from peer's next presence payload; (d) after both ready and `startGame`, clients stop receiving `hubPresenceUpdate` while `stateUpdate` continues during playing phase.

## Technical Specs

- **`game/server/index.js`**
  - Import hub-presence helpers from `game/server/hubPresence.js`.
  - Add `broadcastHubPresence(lobby)` that iterates sockets in `lobby.id` and emits `hubPresenceUpdate` with `buildHubPresenceUpdate(lobby, socket.playerId)`.
  - Call `syncHubPresencePlayer` + `broadcastHubPresence` from `joinPlayerToLobby` and `reconnectPlayerToLobby` when `isLobbyPhase(state)`.
  - Call `removeHubPresencePlayer` + `broadcastHubPresence` from `leaveLobbyForSocket` and disconnected-player eviction paths when the lobby remains and is in lobby phase.
  - In `runGameLoopTick` lobby branch (after `applyPlayerMovement`), sync all connected players into presence and call `broadcastHubPresence(lobby)`.
- **`game/server/hubPresence.js`**
  - Add `syncHubPresenceFromLobbyState(lobby)` helper that walks `lobby.state.players` and upserts connected members (used by tick path).
- **`game/server/test/hub_presence.integration.test.js`** (new)
  - Socket integration tests using helpers from `game/server/test/helpers.js` (`connectClient`, `waitForEvent`, etc.).
  - Patch cosmetics via account API (pattern from `cosmetic_runtime.test.js`) so join-roster assertions verify cosmetic fields.
  - Playing-phase isolation: ready both players, wait for `startGame`, assert no `hubPresenceUpdate` within one tick while `stateUpdate` still arrives.
- **`game/docs/lobbies.md`**
  - Document `hubPresenceUpdate` under Server → client events with payload shape `{ lobbyId, players: { [id]: { x, y, z, rotation, cosmetic, username } } }`.

## Verification: code
