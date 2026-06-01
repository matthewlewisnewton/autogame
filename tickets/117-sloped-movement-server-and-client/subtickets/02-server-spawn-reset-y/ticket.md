# Use sampleFloorY for all server spawn / reset / debug paths

Every place on the server that places a player at a known `(x, z)` position
hardcodes `player.y = 0.5`. Replace those with `sampleFloorY(layout, x, z)`
so players spawn at the correct elevation on sloped floors.

## Acceptance Criteria

- All server-side locations that set `player.y = 0.5` during spawn, reset, or
  debug-scenario placement use `sampleFloorY(state.layout, player.x, player.z)`
  instead, falling back to `DEFAULT_FLOOR_Y` when the result is `null`.
- The affected paths are:
  - `assignRunSpawnPositions()` in `progression.js`
  - `repositionPlayersAwayFromPortal()` in `progression.js`
  - `suspendRunToLobby()` in `progression.js`
  - `giveUpRun()` in `progression.js`
  - `returnPlayersToLobby()` in `progression.js`
  - `applyDebugScenario()` spawn line in `index.js`
- `buildPlayerRecord()` in `index.js` already uses `savedData.y ?? player.y`
  (defaults to 0.5) — update the default to use `sampleFloorY` on the spawn
  position.

## Technical Specs

- **Files**: `game/server/progression.js`, `game/server/index.js`
- In `progression.js`:
  - Import `sampleFloorY` and `DEFAULT_FLOOR_Y` from `../shared/floorSampling.js`
    (or via `./dungeon` which already re-exports them).
  - In each function listed above, after setting `player.x` and `player.z`,
    replace `player.y = 0.5` with:
    ```js
    const floorY = sampleFloorY(_gameState.layout, player.x, player.z);
    player.y = Number.isFinite(floorY) ? floorY : DEFAULT_FLOOR_Y;
    ```
- In `index.js`:
  - In `applyDebugScenario()`, after `player.x = spawn.x; player.z = spawn.z`,
    replace `player.y = 0.5` with the same `sampleFloorY` call.
  - In `buildPlayerRecord()`, the initial `y: 0.5` in the player object literal
    can stay as-is (it gets overwritten by `sampleFloorY` at first spawn),
    but the `savedData.y ?? player.y` fallback should use `DEFAULT_FLOOR_Y`.

## Verification: code
