# Strictly gate debug time-scale on ALLOW_DEBUG_SCENARIOS=1

The `SET_DEBUG_TIME_SCALE` socket handler and the Shift+T keybind currently fall
back to the localhost-permissive `isDebugScenarioAllowed` helper / hostname
check, so on a normal local dev session they enable time scaling even when
`ALLOW_DEBUG_SCENARIOS` is unset. Gate this specific feature strictly on
`process.env.ALLOW_DEBUG_SCENARIOS === '1'` on the server, make the client
keybind/test hook inert unless the server reports the feature is authorized, and
add coverage for the env-unset rejection path.

## Acceptance Criteria

- On the server, `SET_DEBUG_TIME_SCALE` is rejected (no change to
  `state.debugTimeScale`) whenever `process.env.ALLOW_DEBUG_SCENARIOS !== '1'`,
  including on a non-production localhost connection — it must NOT use the
  localhost-permissive `isDebugScenarioAllowed` path for this feature.
- When `process.env.ALLOW_DEBUG_SCENARIOS === '1'`, `SET_DEBUG_TIME_SCALE` still
  works exactly as before (clamps and applies the scale, emits the result).
- The rejection still emits the existing `DEBUG_TIME_SCALE_RESULT` with an
  `ok: false` / `reason` payload so callers can observe the refusal.
- The server exposes whether the feature is authorized to the client (e.g. a
  `debugTimeScaleAllowed` boolean derived from
  `process.env.ALLOW_DEBUG_SCENARIOS === '1'`) via the state snapshot or a
  connect-time message.
- The client Shift+T keybind and `window.__setDebugTimeScaleForTest` are inert
  (emit nothing / no-op) when the server has not reported the feature as
  authorized, instead of relying only on `window.location.hostname` being
  localhost.
- A server test asserts the env-unset rejection path (localhost socket,
  `ALLOW_DEBUG_SCENARIOS` deleted → no state change, `ok: false` result).
- A client test asserts the keybind/test-hook emits nothing when the
  server-authorized flag is false.
- Existing passing behavior for the authorized path (sub-tickets 01–03) is not
  regressed; full vitest server+client suites pass.

## Technical Specs

- `game/server/socketHandlers/lobbyHandlers.js`: change the
  `CLIENT_TO_SERVER.SET_DEBUG_TIME_SCALE` handler (around line 407) to gate on
  `process.env.ALLOW_DEBUG_SCENARIOS === '1'` directly instead of
  `isDebugScenarioAllowed(socket)`. Keep emitting the existing
  `DEBUG_TIME_SCALE_RESULT` rejection payload on refusal. Do NOT alter the
  god-mode / debugScenario handlers that legitimately use
  `isDebugScenarioAllowed`.
- `game/server/index.js` / snapshot builder (and/or `game/server/game-state.js`):
  surface a `debugTimeScaleAllowed` boolean (`process.env.ALLOW_DEBUG_SCENARIOS
  === '1'`) into the state snapshot sent to clients so the client can gate the
  keybind. Reuse the existing snapshot path that already carries
  `debugTimeScale`.
- `game/client/main.js`: track the server-reported `debugTimeScaleAllowed` flag
  from the snapshot (near where `state.debugTimeScale` is applied, ~line 1394).
  Update the Shift+T branch (~line 4255) and `emitSetDebugTimeScale` /
  `window.__setDebugTimeScaleForTest` (~lines 2420–2474) to require this flag
  (not just `debugScenarioAllowed`/hostname). Leave Shift+G god-mode untouched.
  Optionally expose the flag in `window.__AUTOGAME_HARNESS_STATE__()`.
- `game/server/test/`: add a test (extend `debug_time_scale_sim.test.js` or a new
  `debug_time_scale_gate.test.js`) covering the env-unset rejection from a
  localhost socket and the env-set acceptance.
- `game/client/` test (alongside existing client tests): assert the keybind/test
  hook no-ops when `debugTimeScaleAllowed` is false and emits when true.

## Verification: code
