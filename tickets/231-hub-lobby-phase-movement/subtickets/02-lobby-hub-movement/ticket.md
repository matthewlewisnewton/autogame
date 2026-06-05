# Enable lobby-phase hub movement on the server

Allow players to walk the guild hub while `gamePhase === 'lobby'`: the `move` socket handler accepts the same validated input as in-run moves, the game loop integrates lobby movement each tick, and displacement is bounded to hub geometry (not the cached quest layout).

## Acceptance Criteria

- A connected player in lobby phase can emit `move` with finite `dx`, `dz`, `rotation` (and monotonic `sequence` when provided); the server stores input on the player record instead of ignoring it.
- Invalid move payloads are rejected in lobby phase the same way as in playing phase (non-finite values, bad sequence, oversized vectors normalized).
- `runGameLoopTick` calls `applyPlayerMovement` during lobby phase so `stateUpdate` broadcasts updated `x`/`z`/`y`/`rotation`.
- Lobby-phase displacement uses `HUB_LAYOUT` collision geometry (`walkableAABBs`, `dungeonBounds`, wall colliders) — not `state.layout` (quest preview layout).
- Players seated in lobby phase (`joinPlayerToLobby`, `returnPlayersToLobby`, `suspendRunToLobby`) spawn at the hub `role: 'start'` room center so their server position is inside hub walkable bounds.
- Playing-phase movement behavior is unchanged.

## Technical Specs

- **`game/server/simulation.js`**
  - Add `buildHubMovementContext(hubLayout)` (or equivalent) that computes colliders, `walkableAABBs`, and `dungeonBounds` from `HUB_LAYOUT`.
  - Add `hubSpawnPosition(hubLayout)` returning the hub start-room center (same logic the client uses for hub spawn).
  - Extend `applyPlayerMovement` to run when `isLobbyPhase(state)` using the hub movement context; keep playing-phase path from sub-ticket 01.
- **`game/server/socketHandlers/lobbyHandlers.js`**
  - In the `move` handler, replace `if (!isPlayingPhase(state)) return` with acceptance for both `isLobbyPhase(state)` and `isPlayingPhase(state)`; keep dead/extracted/disconnected guards for playing phase; in lobby phase only block disconnected players (not extracted — lobby players are not extracted).
- **`game/server/index.js`**
  - Import/pass `HUB_LAYOUT` into movement helpers.
  - In `runGameLoopTick`, add a lobby branch that calls `applyPlayerMovement(state, buildHubMovementContext(HUB_LAYOUT))` and `flushDirtyPlayerSaves()`.
  - In `joinPlayerToLobby`, when `isLobbyPhase(state)`, set new/revived player `x`/`z`/`y` to `hubSpawnPosition(HUB_LAYOUT)`.
- **`game/server/progression.js`**
  - In `returnPlayersToLobby` and `suspendRunToLobby`, reposition players with `hubSpawnPosition(HUB_LAYOUT)` and sample floor Y from the hub layout (not `state.layout`).

## Verification: code
