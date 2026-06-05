# Telepiping up lands the player in the walkable hub

When a player enters the Telepipe portal (extracts), the client currently shows the
flat lobby overlay (`showExtractedLobbyOverlay`) on top of whatever geometry was last
rendered — i.e. the old 2D-lobby behavior layered over the dungeon. Instead, extracting
(and full suspend) must switch the rendered scene to the walkable hub and seat the avatar
at the hub spawn, so the player is standing in the hub ship-interior, not the dungeon.

## Acceptance Criteria

- When the local player extracts via Telepipe (`playerExtracted` for `myId`), the client
  switches the rendered scene from the dungeon to the hub: `renderedSceneProfile` becomes
  `'hub'` and the local avatar is seated at the hub `role: 'start'` spawn (via the same
  `renderHubScene()` path the lobby uses).
- After extracting, the in-dungeon HUD is hidden, the new-mission Deploy button is hidden,
  and the "Awaiting squad extraction" banner (`THEME.run.awaitingExtract`) is shown — the
  existing extracted-overlay UI behavior is preserved.
- On full suspend (`runSuspended`), the squad also lands in the walkable hub (the existing
  `returnToGuildLobby(..., { rebuildHub: true })` path already does this — confirm it still
  renders the hub and does not regress).
- While extracted with the server still in `gamePhase: 'playing'` (partial extract,
  squadmates still in the dungeon), repeated `stateUpdate`s keep the player in the hub
  scene and re-show the extracted overlay without rebuilding the hub geometry every tick
  or snapping the avatar back into the dungeon.
- No hub layout available (e.g. `hubLayout` null) degrades gracefully to the prior overlay
  behavior rather than throwing.

## Technical Specs

- `game/client/main.js`:
  - `showExtractedLobbyOverlay()` (~line 535): in addition to the existing overlay setup,
    render the walkable hub by calling `renderHubScene()` (guarded by `hubLayout` and
    `isSceneInitialized()`), so the extracted player stands in the hub instead of the
    dungeon geometry. `renderHubScene()` already rebuilds geometry to the hub, seats the
    avatar at the hub spawn, sets `renderedSceneProfile = 'hub'`, and sets the lobby phase.
  - `playerExtracted` handler (~line 1538) and the extracted branch of the `stateUpdate`
    handler (~line 1019, `isExtracted && state.gamePhase === 'playing'`): ensure the hub is
    rendered once on extract and not redundantly rebuilt on every subsequent `stateUpdate`
    (e.g. only call `renderHubScene()` when `renderedSceneProfile !== 'hub'`).
  - Confirm `runSuspended` (~line 1527) still routes through `returnToGuildLobby` with
    `rebuildHub: true` so full suspend lands in the hub.
- Do NOT change server extraction/suspend logic — this is client rendering integration only.

## Verification: code
