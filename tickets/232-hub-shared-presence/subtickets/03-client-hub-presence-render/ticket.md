# Render remote party avatars from hub presence updates

Consume lobby-scoped `hubPresenceUpdate` events on the client and drive remote player meshes (with cosmetics) in the shared hub during the lobby phase.

## Acceptance Criteria

- `main.js` registers a `hubPresenceUpdate` handler. While `gamePhase === 'lobby'`, it merges incoming `players` into `gameState.players` for remote ids (preserving the local player's prediction/input fields and cold deck/inventory data).
- After merge, `setGameStateRef(gameState)` is called so the renderer's animate loop sees peer positions and cosmetics on the next frame.
- `applyLobbyJoinedData` calls `setGameStateRef(gameState)` after assigning `gameState = data.state` so the initial lobby roster (including any party-mates already present) is visible before the first tick.
- Remote avatars in lobby phase use server-provided `x`/`y`/`z`/`rotation` (no client-side prediction for peers). Remote avatar floor Y falls back to hub layout sampling when `y` is missing.
- When a player id disappears from the latest presence payload (or `playerDisconnected` fires), their avatar mesh and nameplate are removed from the scene during lobby phase — not only on the explicit disconnect event.
- A vitest client test feeds a synthetic `hubPresenceUpdate`-shaped merge into renderer state and asserts a second player's mesh exists with the expected cosmetic signature (distinct from the local player).

## Technical Specs

- **`game/client/main.js`**
  - Add `applyHubPresenceUpdate(payload)` helper: merge remote player hot fields (`x`, `y`, `z`, `rotation`, `cosmetic`, `username`) during lobby phase; ignore payload when `gamePhase !== 'lobby'`.
  - Socket handler: `s.on('hubPresenceUpdate', applyHubPresenceUpdate)`.
  - Fix `applyLobbyJoinedData` to invoke `setGameStateRef(gameState)` after loading `data.state`.
- **`game/client/renderer.js`**
  - In the animate loop player sync, after the existing player iteration, dispose `playersMeshes[id]` (and nameplates) for ids no longer in `gs.players` — mirror the existing nameplate-only cleanup at ~line 4240.
  - For remote players during lobby (`currentGamePhase === 'lobby'`), sample floor Y from `gs.layout` (hub) when positioning if needed.
- **`game/client/test/hub-presence-render.test.js`** (new)
  - Vitest test importing `renderer.js`; set lobby phase, local + remote player entries with distinct cosmetics, run one `animate()` frame, assert both meshes exist.

## Verification: code
