# Senior Review — 8BitDo Z lock-on recenters camera; C-stick free-look

## Runtime health
- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block. Servers
  started; capture ran the deterministic full-flow smoke (auth → lobby → ready →
  movement → dodge). Scene initialized (`sceneInitialized: true`, `hasCanvas: true`).
- `console.log`: only benign noise — Vite connect lines, a `409 Conflict` resource
  load (lobby create race during the two-client smoke, pre-existing harness
  behavior, not tagged `pageerror`/`[fatal]`), and three.js model-load warnings in
  the test/headless path. No uncaught page errors, no fatals from game code.
- The smoke capture has no gamepad attached (live-controller test is explicitly out
  of CI scope per the ticket), so the controller behavior is validated by unit tests
  rather than the screenshots — which is exactly what the ticket's Verification asks
  for ("code QA; live-controller test not available in CI").

The game starts and loads cleanly. Runtime-health gate passes.

## Scope of the change
`git diff 726f9b22..HEAD` touches only `game/client/renderer.js` plus test files and
the three sub-ticket `ticket.md` files. The lock-on infrastructure the ticket
targets (8bitdo-64 `lockOnButton: 8`, `isProfileLockOnPressed`, `handleLockOnPress`
`snapBehind` action returning `cameraYawBehindFacing`, and `pollGamepadLook` gating
on `isLockOnActive`) was already present and correct at the baseline. This ticket's
real deliverable is (a) a small renderer refactor and (b) the unit-test coverage the
AC explicitly requires.

## Per-criterion findings

### Z button maps to lock-on (`isProfileLockOnPressed` true on Z)
PASS. `EIGHTBITDO_64_PROFILE.lockOnButton = EIGHTBITDO_64_LOCK_ON_BUTTON = 8`
(gamepad-profiles.js:41,242), labeled "Z (left Z / lock-on)". `isProfileLockOnPressed`
reads button 8 with the 8bitdo threshold (0.2). Verified by new/updated tests:
`gamepad-profiles.test.js` ("reserves Z (button 8) for lock-on", new idle-Z case),
`gamepad.test.js` (edge-fires once per press under profile `8bitdo-64`), and
`input.test.js` (Z edge invokes `onLockOn` via `pollInput`). All pass.

### Engaging lock-on recenters the camera behind the player toward the target
PASS. `applyLockOnPress()` (renderer.js:1278): on `locked`, sets `playerRotation`
toward the enemy and `cameraYaw = cameraYawFromToTarget(toTarget)`; on `snapBehind`
(no target in range), sets `cameraYaw = cameraYawBehindFacing(playerRotation)`. The
new `apply-lock-on-press.test.js` (3 tests) directly asserts: camera snaps toward a
nearby enemy when facing away, snaps behind facing when no enemy is in range, and
the first `updateLockOn` frame starts from the snapped yaw (no jump). The refactor is
behavior-preserving relative to baseline (baseline already set `cameraYaw` from
`result.cameraYaw === cameraYawBehindFacing(playerRotation)`); it makes the
snap-behind branch explicit and adds `get/setCameraYaw` test seams.

### C-stick free-look still works when not locked on
PASS. `pollGamepadLook` (gamepad.js:173) returns 0 when `isLockOnActive()` or
`isLockOnCameraReleasing()`, otherwise reads `read8BitDo64CStickHorizontal` (axis 2)
for the `cStick` look source. New `pollGamepadLook()` tests in `gamepad.test.js`
confirm: non-zero yaw from axis 2 when unlocked, 0 when locked on, 0 during
post-death camera release. Digital C-buttons remain card bindings (not look).

### Mapping verified by unit tests
PASS. 115 tests across the five relevant files pass; the broader renderer suite
(72 tests) also passes — no regression from the `applyLockOnPress` refactor or the
new `get/setCameraYaw` exports.

## Design / regression consistency
Consistent with the GameCube/Z-target intent in the ticket and does not regress the
standard-pad path (`STANDARD_PROFILE` still uses `lockOnButton: LOCK_ON_GAMEPAD_BUTTON`,
`rightStick` look). No new console errors, no dead/broken code introduced. No debug
`?debugScenario` shortcuts added by this ticket.

## Remaining gaps
None blocking. One minor non-blocking redundancy noted in `nits.md`
(`handleLockOnPress` still returns `cameraYaw` for the `snapBehind` action, which
`applyLockOnPress` now recomputes and ignores).

VERDICT: PASS
