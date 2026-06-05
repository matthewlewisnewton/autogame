# Hub presence state on the lobby object

Add a per-lobby `hubPresence` store (on the lobby object, not module globals) that tracks each lobby member's hub position, facing, username, and cosmetic. Provide sync helpers and an interest-management-ready payload builder that accepts a viewer id so future AOI culling can filter entries without changing call sites.

## Acceptance Criteria

- Every lobby created via `createLobby()` initializes `lobby.hubPresence` with `{ revision: 0, players: {} }`.
- `syncHubPresencePlayer(lobby, playerId)` upserts an entry from the authoritative `lobby.state.players[playerId]` record (`x`, `y`, `z`, `rotation`, `cosmetic`, `username`) and bumps `revision` when values change.
- `removeHubPresencePlayer(lobby, playerId)` deletes the entry and bumps `revision`.
- `buildHubPresencePayload(lobby, viewerPlayerId)` returns `{ lobbyId, revision, players }` where `players` is a plain object keyed by player id; today it includes all lobby members, but the `viewerPlayerId` parameter is part of the public API for future per-viewer culling.
- Lobby-phase movement integration (`runGameLoopTick` after `applyPlayerMovement` against `HUB_LAYOUT`) calls `syncHubPresencePlayer` for each connected player in the lobby.
- `joinPlayerToLobby` and `removePlayerFromLobby` / `leaveLobbyForSocket` keep `hubPresence` in sync (add on join, remove on leave).
- Unit tests cover create/init shape, upsert/remove revision bumps, payload field contents (including cosmetic), and that `buildHubPresencePayload` is invoked with a viewer id parameter.

## Technical Specs

- `game/server/hubPresence.js` (new):
  - `createEmptyHubPresence()`, `syncHubPresencePlayer(lobby, playerId)`, `removeHubPresencePlayer(lobby, playerId)`, `buildHubPresenceEntry(player)`, `buildHubPresencePayload(lobby, viewerPlayerId)`.
  - Entry shape: `{ playerId, x, y, z, rotation, cosmetic, username }`.
- `game/server/lobbies.js`:
  - In `createLobby()`, set `lobby.hubPresence = createEmptyHubPresence()`.
  - In `removePlayerFromLobby()`, call `removeHubPresencePlayer` before deleting the lobby when empty.
- `game/server/index.js`:
  - Import hub-presence helpers.
  - After lobby-phase `applyPlayerMovement` in `runGameLoopTick`, sync presence for each `lobby.state.players` entry that is `connected !== false`.
  - In `joinPlayerToLobby`, sync the joining player after hub spawn placement.
  - In `leaveLobbyForSocket` / `notifyPlayerRemoved` path for lobby phase, remove the departing player from `hubPresence`.
- `game/server/test/hub_presence.test.js` (new): unit tests for the module and lobby lifecycle hooks (no socket emit assertions yet — those belong in sub-ticket 02).

## Verification: code
