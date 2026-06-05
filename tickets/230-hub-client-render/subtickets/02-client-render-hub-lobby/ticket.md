# Render the hub and spawn the local avatar during the lobby phase

Use the existing world-stage renderer to render the hub layout (delivered by
the server) while `gamePhase === 'lobby'`, and spawn the local player's avatar
inside it. Keep the quest dungeon flow intact: deploying must switch the
rendered geometry to the quest layout, and returning to the lobby must switch
back to the hub.

Depends on sub-ticket 01 (server delivers `hubLayout` in `lobbyJoined`).

## Acceptance Criteria

- While `gamePhase === 'lobby'`, the renderer scene is built from the hub
  layout (`profile === 'hub'`) — `initScene(hubLayout, ...)` on first entry,
  or `rebuildDungeonLayout(hubLayout)` if the scene already exists.
- The local player's avatar mesh is created and positioned within the hub
  during the lobby phase (spawned at the hub's `role: 'start'` room, i.e. the
  spawn position `buildDungeon` derives from the hub layout).
- Floor sampling for the local avatar uses the hub layout while in the lobby
  (the active `gameState.layout` used by the renderer matches the rendered hub
  geometry, so the avatar sits on the hub floor — not the quest layout).
- Deploying into a run (the `startGame` handler, and joining a lobby already in
  `playing`) rebuilds the rendered geometry to the quest `currentLayout` and
  positions the player at the run spawn — players never deploy into the hub
  geometry.
- Returning to the lobby after a run (the `enteringLobby` transition in the
  `stateUpdate` handler) rebuilds the rendered geometry back to the hub layout.
- The hub renders with walkable collision built (wall colliders + walkable
  AABBs computed from the hub layout, which `initScene` / `rebuildDungeonLayout`
  already do) and no console errors during the lobby phase.
- A client (vitest) test verifies that during the lobby phase the renderer is
  initialized/rebuilt with a `profile: 'hub'` layout and the local player's
  avatar mesh exists, and that deploying rebuilds with the quest layout.

## Technical Specs

- `game/client/main.js`:
  - Add a module-level `hubLayout` cache. In `applyLobbyJoinedData(data)`,
    store `hubLayout = data.hubLayout || hubLayout`. Keep `currentLayout` as the
    quest dungeon layout (unchanged).
  - In the lobby branch of `applyLobbyJoinedData` (the path that currently just
    calls `showGameLobby()` / `updateObjectiveHud()` and returns for a
    `gamePhase === 'lobby'` join): render the hub — if `!isSceneInitialized()`
    call `rendererInitScene(hubLayout, ...)`, else `rebuildDungeonLayout(hubLayout)`;
    set `gameState.layout = hubLayout`; `setGamePhase('lobby')`. Ensure `myId` /
    the game-state ref are set so the animate loop builds the local avatar.
  - In the `startGame` handler (and the `applyLobbyJoinedData` join-into-playing
    branch), before positioning the player, switch geometry to the quest layout:
    `rebuildDungeonLayout(currentLayout)` (when the scene currently shows the hub)
    and set `gameState.layout = currentLayout`. This fixes the existing
    `isSceneInitialized()` fast-path in `startGame` that otherwise reuses the
    already-built hub scene.
  - In the `stateUpdate` handler, on the `enteringLobby` transition (and in
    `returnToGuildLobby`), rebuild to the hub: `rebuildDungeonLayout(hubLayout)`
    and set `gameState.layout = hubLayout`.
- `game/client/renderer.js`: no API changes expected — reuse `initScene`,
  `rebuildDungeonLayout`, `isSceneInitialized`, `setGamePhase`,
  `setPlayerPosition`, `getSpawnPosition`. The animate loop already builds the
  local avatar from `gameStateRef.players[myId]`.
- `game/client/test/` — add a new test (e.g. `hub-lobby-render.test.js`)
  following the existing renderer test mocks (see `renderer-loot.test.js` /
  `renderer-variant.test.js` and `client/test/__mocks__`). Drive a lobby-phase
  render with a hub layout and assert the scene/local avatar reflect the hub,
  and that a deploy rebuilds with the quest layout.
- Do NOT change the opaque `#lobby` DOM overlay or lobby UI panels; this ticket
  is the underlying render + spawn only.

## Verification: code
