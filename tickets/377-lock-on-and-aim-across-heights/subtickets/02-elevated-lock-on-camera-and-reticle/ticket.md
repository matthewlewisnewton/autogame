# 02 — Elevated lock-on camera and reticle

Point the orbit camera and the amber lock-on ring at the locked enemy's true world height (flying or sloped-floor elevated), not the ground plane at `playerY + 0.5` / `GROUND_OVERLAY_Y`. Depends on sub-ticket 01 (`getEntityWorldY` and 3D lock-on state).

## Acceptance Criteria

- While lock-on is active, `updateCameraOrbit` `camera.lookAt` uses the locked enemy's world Y (via `getEntityWorldY(enemy, layout)`), with a small vertical offset (~0.5) at the enemy's body center — not the player's floor height.
- Post-death lock-on camera release (`updateLockOnCameraRelease` / `lockOnReleaseLookAt`) eases look-at toward the last known enemy world Y, not a flat `playerY + 0.5` point.
- `syncLockOnRing` positions the ring at the locked enemy's render height (horizontal disc at body altitude), using the same `renderY` / `flyingRenderOffset` composition as the enemy mesh in `enemySync.js` — not pinned to `GROUND_OVERLAY_Y` on the floor.
- The lock-on ring remains visible and centered on the locked target when that target is airborne; it hides when lock-on clears or cycles away (existing behavior preserved).
- `lock-on-info-panel` continues to show the locked flying enemy's catalog stats when lock-on is active (no regression — panel should not blank for airborne targets).
- Client vitest covers ring Y placement for a flying enemy and camera look-at Y for an elevated locked target (extract a small testable helper if needed, e.g. `resolveLockOnLookAtY(enemy, layout)`).
- Client vitest suite passes.

## Technical Specs

- `game/client/entityWorldY.js` (from 01): import `getEntityWorldY` in `renderer.js`.
- `game/client/renderer.js`:
  - `updateCameraOrbit`: replace `camera.lookAt(lockedEnemy.x, playerY + 0.5, lockedEnemy.z)` with enemy world Y (+ body offset). Optionally blend pitch smoothly rather than snapping.
  - `updateLockOnCameraRelease` call in `updateMyPlayer`: pass real player world Y into release helper; store last locked enemy Y in `lastLockedEnemyPosition` (extend to `{ x, y, z }` in `lockOn.js`) for death-release look-at.
  - `syncLockOnRing(enemyId, enemyX, ringY, enemyZ)`: set mesh position Y to `ringY` (rename/add param); keep ring flat in XZ (`rotation.x = -π/2`).
- `game/client/lockOn.js`:
  - Extend `lastLockedEnemyPosition` to retain `y` from `getEntityWorldY` each frame while locked; use in `startLockOnDeathRelease`.
- `game/client/renderer/enemySync.js`:
  - Pass `renderY` (already computed as `halfHeight + flyingRenderOffset(...)`) into `syncLockOnRing(enemy.id, enemy.x, renderY, enemy.z)`.
- `game/client/test/` (new or extend existing renderer test file):
  - Assert `syncLockOnRing` sets mesh Y to the supplied airborne height when that enemy is the locked target.

## Verification: code
