# Client: hub scene init and lobby walking

Bootstrap the Three.js scene when a player enters the squad lobby so WASD movement
(prediction + `move` emits) runs against hub geometry. Swap to the quest dungeon
layout when the run starts; swap back to hub when returning to lobby.

## Acceptance Criteria

- First `lobbyJoined` while `gamePhase === 'lobby'` initializes the renderer scene
  (`rendererInitScene`) with the server-provided hub `layout` when the scene is not
  yet initialized.
- `applyQuestLayoutFromServer` / `questUpdate` does **not** rebuild dungeon meshes
  during lobby phase (quest selection is metadata-only); rebuild only when
  `gamePhase === 'playing'` or on `startGame`.
- `startGame` handler rebuilds client geometry from the quest layout already applied
  server-side on deploy (`rebuildDungeonLayout` or fresh `rendererInitScene` as today).
- Returning to lobby (`returnToGuildLobby` / `stateUpdate` with `gamePhase === 'lobby'`)
  rebuilds hub geometry from `state.layout` / `lobbyJoined` payload and snaps the local
  player to server `(x, z)`.
- `updateMyPlayer` continues to emit `move` during lobby when the scene is active
  (no new playing-phase guard added).
- Client unit test(s) cover: lobby join triggers scene init with hub profile; quest
  selection payload alone does not call `rebuildDungeonLayout` in lobby.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/client/main.js`:
  - `applyLobbyJoinedData`: when `data.state.gamePhase === 'lobby'` and scene not
    initialized, call `rendererInitScene(currentLayout, spawn from player or hub start)`.
  - `applyQuestLayoutFromServer`: early-return mesh rebuild when
    `gameState?.gamePhase === 'lobby'` (still update `currentLayout` / seed if needed
    for deploy preview, or defer layout swap entirely until `startGame` — pick the
    minimal approach that avoids showing quest geometry in lobby).
  - `stateUpdate` / `returnToGuildLobby`: when entering lobby from playing, call
    `rebuildDungeonLayout` with hub layout from server state if seed/profile changed.
- `game/client/renderer.js`:
  - Confirm `updateMyPlayer` / `animate` run regardless of `currentGamePhase`; adjust
    only if a lobby-phase block exists (remove or narrow it).
  - Optional: allow right-drag camera during lobby (`pointerEvents` / contextmenu guard
    in `setGamePhase`) so walking is usable behind the lobby overlay.
- `game/client/test/main.test.js` (or new `hubLobbyScene.test.js`):
  - Mock `rendererInitScene` / `rebuildDungeonLayout`; assert hub init on lobby join
    and no rebuild on quest-only update in lobby.

## Verification: code
