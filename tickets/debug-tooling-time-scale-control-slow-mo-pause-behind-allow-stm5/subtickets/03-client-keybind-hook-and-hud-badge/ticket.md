# Client: time-scale keybind, test hook, and HUD badge

Add the client side of the debug time-scale tool: a test hook
(`window.__setDebugTimeScaleForTest`), a keybind near the god-mode key that
cycles the scale, a HUD badge showing the active scale so recordings/screenshots
are self-describing, and exposure of the active scale in the harness state
probe. The keybind and hook must do nothing when debug scenarios are disallowed.

## Acceptance Criteria
- `window.__setDebugTimeScaleForTest(scale)` exists and, when the socket is
  connected, emits `SET_DEBUG_TIME_SCALE` with `{ scale }`. It is defined
  alongside the existing `window.__toggleDebugGodmodeForTest` hook.
- A keybind (placed near the existing god-mode key handling, e.g. a key such as
  Shift+T) cycles the debug time scale through a small preset set
  (e.g. `1 → 0.5 → 0.25 → 0 → 1`) by emitting `SET_DEBUG_TIME_SCALE`. The
  keybind respects the same input-focus guard as god mode
  (`isDebugGodmodeKeyBlocked`) and is a no-op when `debugScenarioAllowed` is
  false (so without `ALLOW_DEBUG_SCENARIOS` the key does nothing).
- The client handles the `DEBUG_TIME_SCALE_RESULT` event: on `{ ok: true }` it
  records the active scale and logs it; on `{ ok: false }` it warns with the
  reason and does not change the displayed scale.
- A HUD badge is shown whenever the active scale is not `1`, displaying the
  current scale (e.g. "TIME ×0.25" or "PAUSED" at 0), and is hidden/neutral at
  scale `1`. The badge value tracks the authoritative `debugTimeScale` from
  `stateUpdate` snapshots when present, falling back to the last
  `DEBUG_TIME_SCALE_RESULT`.
- The object returned by the harness state probe (`__getStateForTest`, the
  `return { ... }` near `debugGodmodeResult`) includes the current debug time
  scale (e.g. `debugTimeScale` and/or `debugTimeScaleResult`) so automated
  tests can read it.

## Technical Specs
- `game/client/main.js`:
  - Add a `debugTimeScaleResult` (and/or `debugTimeScale`) module variable near
    `debugGodmodeResult` (~line 1064).
  - Add `s.on(SERVER_TO_CLIENT.DEBUG_TIME_SCALE_RESULT, (data) => {...})`
    next to the `DEBUG_GODMODE_RESULT` handler (~line 1631) to store the scale,
    update the badge, and log/warn.
  - In the `stateUpdate` handler, read `data.debugTimeScale` (added to the
    snapshot in sub-ticket 01) when present to keep the badge authoritative.
  - Add `emitSetDebugTimeScale(scale)` near `emitToggleDebugGodmode` (~2371)
    that guards on `socket?.connected` and emits
    `CLIENT_TO_SERVER.SET_DEBUG_TIME_SCALE` with `{ scale }`.
  - Register the keybind in the same keydown handler that calls
    `emitToggleDebugGodmode` for the god-mode key; gate it on
    `debugScenarioAllowed` and `!isDebugGodmodeKeyBlocked(e)`; cycle a preset
    array and call `emitSetDebugTimeScale`.
  - Expose `window.__setDebugTimeScaleForTest = emitSetDebugTimeScale;` next to
    `window.__toggleDebugGodmodeForTest` (~2420).
  - Add the badge to the HUD: a small element (created in the existing HUD setup
    or `index.html`) toggled visible when scale !== 1, styled like other debug
    HUD text; update its text in one place when the scale changes.
  - Add the scale fields to the `__getStateForTest` return object (~5354).
- `game/client/index.html`: add the badge element if a static node is cleaner
  than creating it in JS (match how the existing debug/god-mode HUD text is
  done).
- Reuse `CLIENT_TO_SERVER` / `SERVER_TO_CLIENT` from the shared events module —
  do not hardcode wire strings.

## Verification: code
