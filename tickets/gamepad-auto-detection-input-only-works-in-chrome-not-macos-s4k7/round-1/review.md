# Senior Review — Gamepad auto-detection + input in macOS Safari

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `pageerrors: []`, servers started, scene initialized
  (`sceneInitialized: true`, `hasCanvas: true`, `connectionState: "connected"`).
- `console.log`: only two benign `409 (Conflict)` resource errors (lobby/auth race
  on the deterministic smoke flow) — no `pageerror`, no `[fatal]`, no uncaught
  exception from game code.
- Full-flow smoke capture (auth → lobby → ready → movement W/D → dodge) succeeds;
  screenshots show normal gameplay. The smoke run dies to grunts (hp 0) by the
  final probe, which is expected for a deterministic capture and not a defect.

Game runs and loads cleanly. Gate passed.

## Acceptance criterion: detection after gesture/button press (not solely load-time `gamepadconnected`), drives input, Safari limitation documented with a user-facing hint

Broken into the three obligations the AC bundles:

### 1. Detection no longer depends solely on a load-time `gamepadconnected` event
Met. New `game/client/gamepad-activation.js` registers one-time gesture listeners
(`pointerdown`/`keydown`/`touchstart`, `{ once: true, passive: true }`) that call
`primeGamepadAccess()` — which flips `accessPrimed` and invokes
`navigator.getGamepads()` once so Safari exposes attached pads. A `requestAnimationFrame`
poll loop (`runPollFrame`/`startPollLoop`) then diffs the pad snapshot each frame
(`detectTransitions`) and emits connect/disconnect transitions to subscribers. This
is wired in both `renderer.js initScene` and at `main.js` top level; the `initDone`
guard makes the double call idempotent. `main.js` now routes BOTH the poll-detected
transition and the native `gamepadconnected`/`gamepaddisconnected` events through a
single `handleGamepadConnectChange`, so Chrome and Safari paths converge. Detection
therefore works even when `gamepadconnected` never fires.

### 2. Detected pad drives input (movement/look/buttons)
Met. Input reads are independent of the activation module: `gamepad.js`
`pollGamepadSnapshot`/`pollGamepadMovement`/`pollGamepadLook`/`pollGamepadButtons`
poll `getPrimaryGamepad()` → `navigator.getGamepads()` every frame. Once the gesture
prime causes Safari to expose the pad, the existing per-frame input poll picks it up
with no further gating. `gamepad.js` and `controller-calibration.js` also subscribe to
`onGamepadActivationChange` to reset gamepad state / refresh the calibration status
display on a detected transition, keeping HUD and calibration UI in sync after a
delayed (post-gesture) connect. The `input.test.js` and `gamepad.test.js` additions
(regression tests for input after delayed activation) cover this.

### 3. Irreducible Safari limitation documented with a user-facing hint
Met. `game/docs/controls.md` gains a "Gamepad / Safari" section covering the
user-gesture requirement, `gamepadconnected` possibly not firing, the secure-context
(HTTPS/localhost) requirement, and a manual-verification recommendation.
`getGamepadActivationHint()` / `formatGamepadDeviceInfo()` in `gamepad-detect.js`
produce browser-specific, primed-aware hint text (with an explicit Safari note via
`isSafariBrowser()` UA detection that correctly excludes Chrome/CriOS/FxiOS/Android),
surfaced in Settings → Controller Calibration (`#gamepad-activation-hint`,
`#gamepad-device-id`) and refreshed live on activation changes. The static
`index.html` placeholder copy was updated to match.

## Consistency / regressions

- Consistent with `docs/controls.md` gamepad/8BitDo conventions; no change to button
  mappings or profiles. The 8BitDo parsing/profile logic is untouched.
- No regression to the native-event path: `gamepadconnected`/`gamepaddisconnected`
  still wired, now sharing the same handler — the prior inline disconnect body was
  de-duplicated into `handleGamepadConnectChange`, behavior preserved.
- No new console errors attributable to the change; rAF loop only does work when
  `accessPrimed`, and is guarded for environments without `requestAnimationFrame`.
- No debug scenario added or changed by this ticket.

## Tests / quality

- `vitest run` on the four affected client suites: 82/82 pass
  (`gamepad-activation` 5, `gamepad-detect` 18, `gamepad` 17, `input` 42).
- Code is well-typed (JSDoc), idiomatic to the surrounding module, and the new
  module cleanly separates priming, polling, and subscription concerns.

The AC is fully and robustly satisfied within what is verifiable without a physical
pad + Safari (the ticket explicitly flags CI cannot test those; manual Safari check
remains a documented follow-up, as intended).

## Remaining gaps

None blocking. (Minor non-blocking nits recorded in `nits.md`.)

VERDICT: PASS
