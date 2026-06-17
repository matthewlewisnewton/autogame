## Redundant guard in removeGestureListeners

In `game/client/gamepad-activation.js`, `removeGestureListeners()` begins with
`if (!onGesture || ...)` but `onGesture` is a module-scoped function declaration
that is never null, so that half of the guard is dead. Tidy it to just the
`typeof window === 'undefined'` check.

### Acceptance Criteria
- The `!onGesture` clause is removed (or replaced with the meaningful check),
  leaving the environment guard intact.
- `gamepad-activation.test.js` still passes.

## rAF poll loop has no stop/teardown path

`startPollLoop()` in `game/client/gamepad-activation.js` starts a
`requestAnimationFrame` loop that runs for the lifetime of the page with no way to
cancel it (the stored `pollFrame` reference is never passed to
`cancelAnimationFrame`). This is fine for the always-on game client, but a small
teardown helper would make the module easier to unit-test and reuse.

### Acceptance Criteria
- A way to stop the poll loop exists (e.g. an exported `stopGamepadActivation()` or
  retained rAF handle) without changing default runtime behavior.
- Existing tests continue to pass.
