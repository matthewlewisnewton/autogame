# Broadcast hub presence to the lobby room

Emit lobby-scoped `hubPresenceUpdate` events from the per-lobby `hubPresence`
store (sub-ticket 01). Include full snapshots suitable for later per-viewer
culling without changing the wire shape. Wire join, leave, disconnect, and
reconnect so presence updates immediately when membership changes.

Depends on sub-ticket 01.

## Acceptance Criteria

- Server emits `hubPresenceUpdate` to `io.to(lobby.id)` with payload shaped like
  `{ lobbyId, presence: { schemaVersion, entries }, removedPlayerIds?: string[] }`.
- During `gamePhase === 'lobby'`, each game-loop tick after
  `syncHubPresenceFromLobby`, connected clients in that lobby receive an update
  when any entry position/rotation/cosmetic changed (monotonic `revision` on
  `hubPresence` is fine; full snapshot each tick is acceptable for v1).
- `lobbyJoined` includes `hubPresence` (full snapshot) so a joining client sees
  existing party-mates immediately.
- When a player joins a lobby in lobby phase, other members receive a
  `hubPresenceUpdate` that includes the new entry; the joiner already has the
  snapshot from `lobbyJoined`.
- When a player leaves, is evicted after disconnect grace, or is removed from
  the lobby, remaining members receive `hubPresenceUpdate` with that id in
  `removedPlayerIds` and without that entry in `presence.entries`.
- Reconnect (`reconnectPlayerToLobby`) restores the player's entry and broadcasts
  an update to the lobby room.
- No `hubPresenceUpdate` is emitted for lobbies in `gamePhase === 'playing'`
  (dungeon sync continues to use `stateUpdate`).
- Server integration test: two sockets in the same lobby (lobby phase); player A
  emits `move`; player B receives `hubPresenceUpdate` with A's position changed
  from the hub spawn.

## Technical Specs

- `game/server/hubPresence.js` — add `emitHubPresenceUpdate(io, lobby, opts?)`
  and helpers to diff or always send full `getHubPresenceSnapshot(lobby)`; bump
  `lobby.hubPresence.revision` when entries change.
- `game/server/index.js`:
  - Attach `hubPresence` to `emitLobbyJoined` payload.
  - After `syncHubPresenceFromLobby` in the lobby-phase tick branch, call emit.
  - Call emit from `joinPlayerToLobby`, `leaveLobbyForSocket` /
    `notifyPlayerRemoved` (lobby phase), `reconnectPlayerToLobby`, and disconnect
    soft-leave paths that keep the player record (mark `connected: false` in
    entries or remove — match 01's connected rule and test it).
- `game/docs/lobbies.md` — document `hubPresenceUpdate` under server → client
  events (one row + short shape note).
- `game/server/test/hub_presence_broadcast.test.js` (new) — use
  `connectTwoClients` / `waitForEvent` from `server/test/helpers.js`; assert
  join snapshot, move broadcast, and leave `removedPlayerIds`.

## Verification: code
