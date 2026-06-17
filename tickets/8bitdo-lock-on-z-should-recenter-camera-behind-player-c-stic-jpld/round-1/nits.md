## Redundant `cameraYaw` in `handleLockOnPress` snapBehind result
`handleLockOnPress` returns `{ action: 'snapBehind', cameraYaw: cameraYawBehindFacing(playerRotation) }`
(game/client/lockOn.js:402,420,437), but `applyLockOnPress` now ignores that field and
recomputes `cameraYawBehindFacing(playerRotation)` itself (game/client/renderer.js:1306).
The returned `cameraYaw` is dead for the snapBehind path. Harmless, but the duplicate
source of truth invites drift if one side changes. Worth a small cleanup: either have
the renderer consume `result.cameraYaw` for snapBehind, or drop `cameraYaw` from the
snapBehind return shape and its JSDoc.

### Acceptance Criteria
- `applyLockOnPress` and `handleLockOnPress` agree on a single source for the
  snap-behind camera yaw (no recomputation of a value the callee already returned).
- Existing lock-on / apply-lock-on-press unit tests still pass.
