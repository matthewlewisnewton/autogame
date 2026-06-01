# Wire sampleFloorY into client local avatar Y position

The client renderer hardcodes the local player mesh Y to `0.5` in the render
loop (`renderer.js` line ~2425). Update it to use `sampleFloorY()` so the local
avatar tracks the floor surface on sloped rooms.

## Acceptance Criteria

- The local player mesh in `renderer.js` uses `sampleFloorY(currentLayout, myX, myZ)`
  for its Y position instead of the hardcoded `0.5`.
- When `sampleFloorY` returns `null`, fall back to `DEFAULT_FLOOR_Y` (0.5).
- Remote player meshes already read `pData.y` from the state snapshot (with `|| 0.5`
  fallback) — no change needed there, as the server now sends correct Y values
  (sub-tickets 01 and 02).
- The client-side `tryPlayerMove` in `collision.js` remains 2D (XZ only); Y is
  purely a visual concern on the client.

## Technical Specs

- **File**: `game/client/renderer.js`
  - `sampleFloorY` and `DEFAULT_FLOOR_Y` are already available via `collision.js`
    (which re-exports from `../shared/floorSampling.esm.js`). Import them if not
    already in scope, or import directly from `../shared/floorSampling.esm.js`.
  - In the render loop (around line 2425), replace:
    ```js
    playersMeshes[myId].position.set(myX, 0.5, myZ);
    ```
    with:
    ```js
    const layout = currentLayout || (gameState && gameState.layout);
    const floorY = layout ? (sampleFloorY(layout, myX, myZ) ?? DEFAULT_FLOOR_Y) : DEFAULT_FLOOR_Y;
    playersMeshes[myId].position.set(myX, floorY, myZ);
    ```
  - The `currentLayout` variable is maintained in `main.js` and passed to the
    renderer; ensure it's accessible in the render scope (it is — `setGameStateRef`
    and `rebuildDungeonLayout` keep it in sync).

## Verification: code
