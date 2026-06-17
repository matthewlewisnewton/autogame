# Snap camera behind player when lock-on engages

When lock-on is triggered (keyboard Z or gamepad lock-on button), the orbit camera must immediately recenter behind the player—toward the locked enemy when one is in range, or behind the player's current facing when no target is available. This is the GameCube/OoT Z-target snap, distinct from the per-frame camera tracking that runs while already locked.

## Acceptance Criteria

- `applyLockOnPress()` in `renderer.js`, when `handleLockOnPress` returns `action: 'locked'`, sets `cameraYaw` to `cameraYawFromToTarget(toTarget)` (normalized) and aligns `playerRotation` to face the target on the same frame.
- When `handleLockOnPress` returns `action: 'snapBehind'` (no enemy in range), `applyLockOnPress()` sets `cameraYaw` to `cameraYawBehindFacing(playerRotation)` (normalized).
- Engaging lock-on calls `resetLockOnTracking()` so the subsequent per-frame `updateLockOn` camera advance starts from the snapped yaw rather than lerping slowly from a stale offset.
- `handleLockOnPress` continues to return `cameraYaw` on `locked` and `snapBehind` results (used by `applyLockOnPress`).
- Unit tests assert the snap yaw values for at least: (a) lock onto a nearby enemy with the camera initially facing a different direction, and (b) press with no enemy in range.

## Technical Specs

- **`game/client/renderer.js`**: `applyLockOnPress()` — verify/fix the `result.action === 'locked'` branch to snap `cameraYaw` via `cameraYawFromToTarget(getDirectionToTarget(...))` and the `snapBehind` branch to assign `result.cameraYaw`. Keep `clearLockOnCameraRelease()`, `lockOnReleaseLookAt = null`, and `resetLockOnTracking()` on engage.
- **`game/client/lockOn.js`**: `handleLockOnPress`, `cameraYawFromToTarget`, `cameraYawBehindFacing`, `cameraYawBehindTarget` — source of truth for target yaw math; adjust only if snap values are wrong.
- **`game/client/config.js`**: `LOCK_ON_CAMERA_LERP` is defined but unused; do not wire it unless needed for the initial snap (immediate assignment is preferred for this ticket).
- **Tests**: Add cases in `game/client/test/lockOn.test.js` and/or a new focused test (e.g. `game/client/test/apply-lock-on-press.test.js`) that imports `applyLockOnPress` with minimal renderer harness state, or tests the snap math + `applyLockOnPress` side effects on `cameraYaw` through exported test hooks if available.

## Verification: code
