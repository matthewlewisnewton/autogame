# 01 — Lock-on 3D target selection and tracking

Add a client-side world-Y helper and teach `lockOn.js` to pick, cycle, and retain lock-on targets using true 3D distance (including flying enemies and elevated `enemy.y`), not just XZ planar distance. `applyLockOnPress` must anchor from the player's world Y so height-separated targets at the same `(x, z)` resolve correctly.

## Acceptance Criteria

- A shared client helper `getEntityWorldY(entity, layout)` returns the same world Y the server uses: grounded entities use `entity.y` or `sampleFloorY(layout, x, z)`; flying entities use `entity.y` or `floorY + altitude`.
- `findClosestTargetableEnemy` ranks candidates by 3D distance from `(playerX, playerY, playerZ)` and still respects `LOCK_ON_RANGE`, dead-enemy skip, and `excludeId`.
- `updateLockOn` breaks lock when 3D distance exceeds `LOCK_ON_BREAK_RANGE` (not XZ-only).
- `handleLockOnPress` (lock, cycle, reacquire) uses the 3D nearest-enemy path; when a ground enemy and a flying enemy share `(x, z)`, the closer in 3D space is selected.
- `lockOnAnchorCoords()` in `renderer.js` includes the local player's world Y (from server `me.y` or floor sampling fallback).
- `game/client/test/lockOn.test.js` covers: elevated `enemy.y` selection, flying `flying: true` + `altitude` selection, 3D break-range release, and cycle skipping a farther elevated target.
- Client vitest suite passes.

## Technical Specs

- **New** `game/client/entityWorldY.js`:
  - Export `getEntityWorldY(entity, layout)` mirroring `game/server/simulation.js` `getEntityWorldY` / `resolveEntityY` (import `sampleFloorY` from `shared/floorSampling.esm.js`, use `DEFAULT_FLOOR_Y` / `FLOOR_Y` constants from client config as today).
- `game/client/lockOn.js`:
  - Import `getEntityWorldY`; thread `playerY` through `findClosestTargetableEnemy`, `handleLockOnPress`, and `updateLockOn`.
  - Replace `Math.hypot(dx, dz)` distance checks with `Math.hypot(dx, dy, dz)` using world Y for both player and enemy.
  - Extend JSDoc typedefs to include optional `y`, `flying`, `altitude` on enemy objects.
- `game/client/renderer.js`:
  - Update `lockOnAnchorCoords()` to return `{ x, y, z }` with `y` from `getEntityWorldY(me, layout)` (layout from `gameStateRef`).
  - Pass `anchor.y` into `handleLockOnPress` / `getDirectionToTarget` call sites in `applyLockOnPress` and `updateLockOn` (`updateMyPlayer`).
- `game/client/test/lockOn.test.js`:
  - Add cases with stacked ground vs elevated enemies and flying enemies; assert locked id and break-range behavior.

## Verification: code
