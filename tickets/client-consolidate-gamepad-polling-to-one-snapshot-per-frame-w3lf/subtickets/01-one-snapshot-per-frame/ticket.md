# Consolidate gamepad polling to a single per-frame snapshot

Today one animation frame calls `navigator.getGamepads()` 5–8 times — once (or more)
inside `getMovementDirection`, `pollGamepadMovement`, `pollGamepadLook`,
`pollGamepadButtons`, and `pollInput`, each through `getActiveGamepad` /
`getPrimaryGamepad` → `getConnectedGamepads()` → `Array.from(navigator.getGamepads()).filter(Boolean)`.
Poll the pad once per frame into a cached snapshot consumed by every reader, and
track lock-on previous state as a single boolean instead of rebuilding a full
`prevButtons` array each frame. Input behaviour must be byte-for-byte unchanged.

## Acceptance Criteria

- During a normal animation frame, `navigator.getGamepads()` is invoked **at most
  once** — all gamepad readers in that frame consume one shared cached snapshot
  rather than each calling `getConnectedGamepads()` / `getPrimaryGamepad()` again.
- A snapshot is captured once near the top of the per-frame loop (`animate()` in
  `renderer.js`) before movement/look/button readers run, and contains at least the
  resolved primary `pad`, the resolved `profile`, and the resolved gamepad `cfg`
  (and any C-button state needed by readers) so readers do not re-resolve them.
- `pollGamepadButtons()` no longer rebuilds a per-frame `prevButtons` array; lock-on
  edge detection is driven by a single cached boolean for the previous lock-on
  pressed state. The edge-trigger semantics (fires once on press, not while held,
  resets on pad loss / `resetGamepadState()`) are unchanged.
- The 8BitDo 64 C-button state (`read8BitDo64CButtonState`) is read at most once per
  frame and reused across all C-button slot bindings rather than re-read per binding.
- Direct calls to the reader functions (e.g. from unit tests, which install a mock
  `navigator.getGamepads` and call `pollGamepadButtons()` / `pollGamepadMovement()`
  without first capturing a frame snapshot) still return correct results — i.e. a
  reader lazily builds a snapshot when none is cached for the current frame.
- All existing client tests pass unchanged: `pnpm --filter @autogame/client test`
  (notably `gamepad.test.js`, `input.test.js`, `gamepad-profiles.test.js`,
  `renderer-*.test.js`). No test assertions are weakened to accommodate the refactor.

## Technical Specs

- `game/client/gamepad.js`: introduce a module-level cached snapshot
  `{ pad, profile, cfg, cState }` plus a `pollGamepadSnapshot()` (or equivalently
  named) function that resolves the primary pad, profile, gamepad config, and (when
  the profile needs it) the C-button state exactly once and stores it. Add a getter
  that returns the cached snapshot, lazily populating it if not yet captured this
  frame. Rewire `getActiveGamepad`, `pollGamepadMovement`, `pollGamepadLook`, and
  `pollGamepadButtons` to consume the snapshot instead of calling `getActiveGamepad`
  /`resolveGamepadProfile`/`getGamepadConfig` independently. Replace the `let
  prevButtons = []` array with a single boolean (e.g. `let prevLockOnPressed`) and
  update `resetGamepadState()` accordingly.
- `game/client/input.js`: in `pollInput()` and `getMovementDirection()`, consume the
  shared snapshot (pad + profile + cfg) rather than calling `getPrimaryGamepad()` and
  `getActiveProfile()` again. Keep `prevGamepadButtons` (the per-action edge map)
  behaviour identical.
- `game/client/renderer.js`: in `animate()`, call the new `pollGamepadSnapshot()`
  once before `updateMyPlayer(delta)` / `pollInput()` so movement, look, and button
  readers all see the same frame snapshot. Clear/invalidate the snapshot at the
  appropriate point (e.g. start of each frame) so a fresh pad is read every frame.
- Do **not** change input semantics, deadzones, sensitivity, bindings, or profile
  resolution logic — this is a pure polling-consolidation refactor.
- Do **not** remove dead code in this sub-ticket (handled separately in 02).

## Verification: code
