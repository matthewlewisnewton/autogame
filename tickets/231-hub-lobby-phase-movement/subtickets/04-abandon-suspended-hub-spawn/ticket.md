# Seat abandoned suspended runs at hub spawn

When a squad abandons a suspended expedition, `abandonSuspendedRun()` still places players at `firstRoomPosition()` from the quest layout (e.g. `z ≈ 27`), which is outside `HUB_LAYOUT` walkable bounds. Align this path with `suspendRunToLobby` and `returnPlayersToLobby` so abandoned players land in the hub and can walk normally during lobby phase.

## Acceptance Criteria

- After `abandonSuspendedRun()` succeeds, every player in the lobby has `x`/`z` at the hub start-room center from `hubSpawnPosition(HUB_LAYOUT)` (same spawn used by other lobby seating paths).
- Player `y` is sampled from `HUB_LAYOUT` via `sampleFloorY(HUB_LAYOUT, player.x, player.z)` — not from `state.layout`.
- Each repositioned player is inside hub walkable geometry: within `computeDungeonBounds(HUB_LAYOUT)` and `isInsideDungeon(x, z, buildHubMovementContext(HUB_LAYOUT))`.
- Existing `abandonSuspendedRun clears checkpoint and run` behavior is preserved (`ok: true`, checkpoint cleared, run deleted, `gamePhase === 'lobby'`).
- A regression test covers the suspend → abandon flow and asserts hub seating (not merely checkpoint cleanup).
- `pnpm test:quick` passes with the new/updated assertions.

## Technical Specs

- **`game/server/progression.js`**
  - In `abandonSuspendedRun()`, replace `const spawn = firstRoomPosition()` with `const spawn = hubSpawnPosition(HUB_LAYOUT)`.
  - Replace `sampleFloorY(state.layout, player.x, player.z)` with `sampleFloorY(HUB_LAYOUT, player.x, player.z)`.
  - Mirror the repositioning pattern already used in `suspendRunToLobby()` (lines ~2638–2645) and `returnPlayersToLobby()` (lines ~2943–2956); do not change checkpoint clearing, phase transition, or broadcast logic.
- **`game/server/test/server.test.js`** (preferred — already exercises telepipe suspend + abandon)
  - Extend the existing `abandonSuspendedRun clears checkpoint and run` case (or add a sibling `it`) to assert each player's `x`/`z`/`y` matches hub spawn and floor sampling.
  - Import `HUB_LAYOUT`, `hubSpawnPosition`, `buildHubMovementContext`, `computeDungeonBounds`, and `isInsideDungeon` as needed.
  - Assert hub bounds/walkability using the same helpers/patterns as `lobby_hub_movement.test.js` (`assertPlayerWithinHub` logic).
- **Alternatively `game/server/test/lobby_hub_movement.test.js`** if a socket-level suspend → abandon flow is clearer; either file is acceptable as long as the regression is covered.

## Verification: code
