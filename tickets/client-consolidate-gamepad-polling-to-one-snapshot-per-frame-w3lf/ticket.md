# Client: consolidate gamepad polling to one snapshot per frame and delete dead gamepad-layer code

## Difficulty: medium

## Goal

One frame calls navigator.getGamepads() (fresh array + Gamepad snapshots in Chromium) 5-8 times via getMovementDirection (2-3x), pollInput, pollGamepadButtons, and pollGamepadLook, each wrapped in Array.from(...).filter(Boolean) (game/client/gamepad-detect.js:145-148, gamepad.js:125-147, input.js:251-286, renderer.js:988,1287,1777,6167). pollGamepadButtons rebuilds prevButtons with a closure every frame though only the lock-on index is read; the 8BitDo profile re-runs read8BitDo64CButtonState per cButton binding per frame. Fix: poll once per frame into a cached snapshot { pad, profile, cfg, cState } consumed by all readers; track one boolean for lock-on prev state. Also delete confirmed-dead code in game/client/gamepad-profiles.js:80-104,386-396,424-438,475-480 and input.js:69-80,242-246,446-451: uses8BitDo64DigitalCButtons hardcodes true making get8BitDo64CStickAxes/get8BitDo64CAxisPairs always null/[] (so axis cX/cY bindings silently never activate), readAxisSectorDirections/readProfileCStick/isGamepadMoving/describeGamepadConnectionWithProfile are unused outside tests, and isButtonPressed duplicates isGamepadButtonActive. Found in code review 2026-06-09.

## Acceptance Criteria

- navigator.getGamepads() called at most once per frame; input behavior unchanged (existing gamepad/input tests pass after dead-code removal); dead exports removed along with their orphan tests

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
