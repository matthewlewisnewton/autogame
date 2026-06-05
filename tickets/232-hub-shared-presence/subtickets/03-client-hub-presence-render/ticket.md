# Client hub presence sync and remote avatar rendering

Wire the client to consume `hubPresenceUpdate` during the lobby phase, merge presence entries into the renderer's `gameState.players`, and ensure remote hub avatars (with cosmetics) are created, positioned, and torn down when party-mates join, move, or leave.

Depends on sub-ticket 02 (`hubPresenceUpdate` broadcasts).

## Acceptance Criteria

- `main.js` registers a `hubPresenceUpdate` handler that, when `gameState.gamePhase === 'lobby'`, merges each payload `players[id]` entry into `gameState.players[id]` (position, rotation, cosmetic, username) without discarding unrelated per-player fields already on the local record.
- The handler ignores or no-ops `hubPresenceUpdate` while `gamePhase === 'playing'` so dungeon `stateUpdate` remains authoritative in-run.
- When a player id disappears from the latest presence `players` map, that id is removed from `gameState.players` so the renderer stops drawing them.
- During the lobby phase, the renderer creates a mesh for a remote party-mate with a distinct cosmetic (verifiable via `userData.cosmeticKey` / `createPlayerAvatar` path) and updates `position`/`rotation` on subsequent presence updates.
- Departed remote players have both their avatar mesh and nameplate disposed (no ghost avatars left in the scene).
- A client vitest drives a lobby-phase `gameState` with two players (local + remote) through `setGameStateRef` + `animate()` and asserts the remote mesh exists with the expected cosmetic signature; a second call after removing the remote id from `players` asserts the mesh is gone.

## Technical Specs

- `game/client/main.js`:
  - Add `applyHubPresenceUpdate(payload)` that merges/removes players as described above, then calls `setGameStateRef(gameState)`.
  - Register `socket.on('hubPresenceUpdate', applyHubPresenceUpdate)` alongside existing lobby handlers.
  - Optionally seed from an initial `hubPresenceUpdate` included in `lobbyJoined` only if sub-ticket 02 adds it; otherwise rely on the first tick/join broadcast.
- `game/client/renderer.js`:
  - In the `animate()` player-mesh loop, after syncing meshes, dispose and remove any `playersMeshes[id]` (and `playerNameplates[id]`) whose id is absent from `gs.players` — mirror the existing nameplate-only cleanup at ~4270.
- `game/client/test/hub-presence-render.test.js` (new):
  - Mock renderer dependencies following `hub-lobby-render.test.js` / `avatar-cosmetic-render.test.js` patterns.
  - Two-player lobby scenario with cosmetic-bearing remote entry, then departure cleanup assertion.

## Verification: code
