# Senior Review

## Per-Criterion Findings

### Runtime health

PASS. The captured run is valid: `metrics.json` has `"ok": true`, the servers started on the recorded ports, `pageerrors` is empty, and `console.log` contains no `pageerror` or `[fatal]` lines from game code. The capture reached lobby and gameplay, showed movement after W/D input, and showed the dodge/key-item cooldown HUD. The only visible console/server noise is benign for this review: Vite websocket close noise, THREE deprecation warnings, and an expected auth/register conflict during the harness flow.

### `navigator.getGamepads()` is called at most once per gameplay frame

PASS. `renderer.animate()` now captures a shared gamepad snapshot once near the top of the frame with `pollGamepadSnapshot()`, then invalidates it after rendering. The movement, button, lock-on, and look readers all consume `getGamepadSnapshot()` instead of independently resolving the active pad/profile/config. The remaining direct gamepad polls are outside the normal gameplay reader path, such as tests and controller/settings capture UI, and do not undermine the fixed per-frame gameplay loop called out by the ticket.

### Input behavior is unchanged

PASS. The snapshot keeps the same pad/profile/config inputs available to `getMovementDirection()`, `pollInput()`, `pollGamepadButtons()`, and `pollGamepadLook()`. Keyboard movement still merges with stick input, lock-on remains edge-triggered, 8BitDo 64 C-buttons still map to hand slots, and the 8BitDo lock-on threshold still accepts low analog trigger values. The captured gameplay also verifies the foundation requirements still hold: the client renders, connects to the server, enters a run, shows the local and remote players, and moves in response to input.

### Dead gamepad-layer code and orphan tests

PASS. The confirmed-dead helpers named in the ticket are no longer exported or referenced in `game/client/`: `uses8BitDo64DigitalCButtons`, `get8BitDo64CStickAxes`, `get8BitDo64CAxisPairs`, `readAxisSectorDirections`, `readProfileCStick`, `isGamepadMoving`, `describeGamepadConnectionWithProfile`, and the duplicate `isButtonPressed`. The tests tied only to those removed helpers were deleted, while live 8BitDo C-button, profile, lock-on, and binding behavior remains covered.

### Design and requirements consistency

PASS. The change is limited to client input polling and dead-code cleanup. It does not alter the documented lobby/dungeon/card loop, server simulation, multiplayer flow, or floor/quest/combat systems. The capture and probes confirm the baseline setup requirements remain intact: 3D rendering, server-client connection, multiplayer visualization, and movement synchronization.

### Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=...` shortcut. The capture used the fallback full-flow smoke path with `scenarios: []`, so there is no debug-scenario gating or normal-gameplay reachability issue to review for this ticket.

### Verification evidence

PASS. The round-1 coverage log reports `52` test files passed and `540` tests passed. Coverage thresholds were disabled as expected for visibility only.

## Remaining gaps

No blocking gaps remain.
VERDICT: PASS
