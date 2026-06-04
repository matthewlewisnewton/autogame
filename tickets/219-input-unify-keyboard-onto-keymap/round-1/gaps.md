1. `getMovementDirection()` drops active WASD whenever gamepad stick/D-pad movement is present, so keyboard+gamepad movement no longer merges.
   Files: `game/client/input.js`, `game/client/renderer.js`
   Fix: combine the keyboard vector with `pollGamepadMovement()` using `mergeMovementVectors()` or equivalent sign-correct normalization, and add a test for simultaneous keyboard plus gamepad input.

2. Movement keyup is ignored from typing targets, so releasing a held movement key after focus enters an input/contenteditable can leave movement stuck on.
   Files: `game/client/input.js`
   Fix: keep the typing-target guard on keydown, but always let movement keyup clear `keyState`; add a regression test that focuses an input before releasing `w`.
