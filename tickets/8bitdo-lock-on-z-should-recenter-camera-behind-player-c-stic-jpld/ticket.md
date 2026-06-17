# 8BitDo: lock-on (Z) should recenter camera behind player; C-stick free-look mapping is unexpected

## Difficulty: medium

## Goal

On the 8BitDo 64 controller (profile '8bitdo-64', game/client/gamepad-profiles.js), camera left/right is driven by free-look on the C-stick (lookSource: 'cStick'), but the expected behavior is GameCube/Z-target style: the Z button triggers LOCK-ON, which snaps/recenters the camera behind the character. Currently either lock-on isn't mapped to the 8BitDo Z button or it doesn't recenter the camera as expected. Relevant: LOCK_ON_GAMEPAD_BUTTON=6 (game/client/config.js:163) is the standard-pad lock-on button; the 8bitdo-64 profile defines its own lockOnButton + isProfileLockOnPressed (gamepad-profiles.js); lock-on camera behavior is in game/client/lockOn.js (LOCK_ON_CAMERA_LERP etc.). FIX: ensure the 8BitDo profile maps lock-on to the physical Z button, and that engaging lock-on recenters the camera behind the player (then C-stick free-look applies when not locked on). REPRO: connect 8BitDo 64, press Z near an enemy — expected camera snaps behind character toward target; actual: C-stick still just free-looks. Verify the profile button mapping + lock-on camera recenter logic (code QA; live-controller test not available in CI).

## Acceptance Criteria

- On the 8bitdo-64 profile, the physical Z button maps to lock-on (isProfileLockOnPressed true on Z); engaging lock-on recenters the camera behind the player toward the target; C-stick free-look still works when not locked on. Mapping verified by unit tests of the profile + lock-on logic.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
