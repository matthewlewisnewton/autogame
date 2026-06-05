# Lobby-scoped hub presence state module

Add a dedicated hub-presence registry on each lobby object (not module-level globals) with pure sync/build helpers structured for future per-viewer interest culling.

## Acceptance Criteria

- Each lobby created via `createLobby()` owns a `hubPresence` object on the lobby record (sibling to `state`, not on the global singleton).
- `hubPresence` tracks connected lobby members as `{ [playerId]: { x, y, z, rotation, cosmetic, username } }` — position + cosmetic fields only (no deck/hand/run data).
- `syncHubPresencePlayer(lobby, playerId, playerRecord)` upserts one entry from the authoritative player record; `removeHubPresencePlayer(lobby, playerId)` deletes one entry; both are no-ops-safe when `lobby` or `playerId` is missing.
- `buildHubPresenceUpdate(lobby, viewerPlayerId)` returns `{ lobbyId, players }` scoped to that lobby. It accepts a `viewerPlayerId` culling hook — today it returns all connected entries in `hubPresence`, but the signature and call site must support filtering per viewer later (document the hook with a short comment, no culling logic yet).
- `ensureHubPresence(lobby)` initializes `hubPresence.players` as `{}` when absent; deleting a lobby removes its presence with the lobby (no orphaned global map).
- Unit tests in `game/server/test/hub_presence.test.js` cover create/init, upsert/remove, cosmetic passthrough, and that `viewerPlayerId` is accepted without changing current all-players output.

## Technical Specs

- **`game/server/hubPresence.js`** (new)
  - Export `ensureHubPresence`, `syncHubPresencePlayer`, `removeHubPresencePlayer`, `buildHubPresenceUpdate`.
  - Source `cosmetic` via `backfillCosmetic` from `game/server/cosmetic.js` when building entries.
  - Skip players with `connected === false` when building the broadcast payload.
- **`game/server/lobbies.js`**
  - In `createLobby()`, call `ensureHubPresence(lobby)` so every lobby starts with an empty presence registry.
  - Export `ensureHubPresence` re-export or require hubPresence helpers where join/leave wiring will call them (sub-ticket 02).
- **`game/server/test/hub_presence.test.js`** (new)
  - Vitest unit tests for the module in isolation (no HTTP server required).

## Verification: code
