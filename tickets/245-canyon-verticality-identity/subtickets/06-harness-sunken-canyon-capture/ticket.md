# Harness visual capture reaches sunken-canyon layout

Round-1 visual acceptance never entered the sunken-canyon stage: the harness
`emitScenario sunken-canyon-stage` step returned `{ ok: false, reason: "Debug
scenarios are disabled" }`, so `metrics.json` probes still report
`layout.profile: "crowded"` and `06-after-sunken-canyon.png` shows the default
training layout. Fix the capture path so the existing world-stage screenshot
flow can swap into `layout.profile === "sunken-canyon"` and holistically
exercise the canyon identity features from sub-tickets 01–05.

## Acceptance Criteria

- During a harness capture on a non-default port pair (e.g. game `3001` / vite
  `5174`), the `sunken-canyon-stage` debug scenario invoked via
  `emitScenario` returns `{ ok: true }` (`debugScenarioResult.ok === true` in
  the post-transition probe).
- After the world-stage transition step, harness probes report
  `harnessState.layout.profile === "sunken-canyon"` (changed from the pre-step
  `"crowded"` / default training profile) with a valid `startRoom`.
- The post-transition player position is within 1 unit of the new layout
  `startRoom` x/z (same tolerance as
  `game/client/scripts/test-world-stage-transition.mjs`).
- `metrics.json` from a full ticket capture reports `"ok": true`,
  `pageerrors.json` is empty, and `console.log` contains no
  `[debugScenario] Debug scenarios are disabled` warning for the transition step.
- `game/client/scripts/test-world-stage-transition.mjs` still exits 0 when run
  standalone (isolated ports, `ALLOW_DEBUG_SCENARIOS=1`).
- `game/server/test/debug-gate.test.js` stays green; add a regression case that
  IPv4-mapped loopback (`::ffff:127.0.0.1`) is allowed while public peer
  addresses with localhost-looking headers remain rejected.
- Production security posture unchanged: `NODE_ENV=production` without
  `ALLOW_DEBUG_SCENARIOS=1` still rejects debug scenarios from non-loopback
  peers.

## Technical Specs

- **`game/server/index.js`**
  - Extend `isDebugScenarioAllowed()` so Vite-proxied Socket.IO connections
    from the harness are treated as local: accept IPv4-mapped loopback addresses
    (e.g. `::ffff:127.0.0.1`) in addition to `127.0.0.1`, `::1`, and
    `*.127.0.0.1` suffix matches. Keep the existing `ALLOW_DEBUG_SCENARIOS=1`
    fast-path and `NODE_ENV=production` guard unchanged; do **not** reintroduce
    Origin/Host header checks (ticket #265 hardening).
- **`harness/steps/game.py`**
  - When spawning the game server subprocess in `start_game`, merge
    `ALLOW_DEBUG_SCENARIOS=1` into the server `env` (alongside `PORT`), matching
    the isolated smoke scripts under `game/client/scripts/`. Harness capture is
    dev-only; this ensures `emitScenario` steps succeed even if peer-address
    parsing varies across Node/OS versions.
- **`harness/tests/unit/test_game_start.py`**
  - Assert the server `Popen` env includes `ALLOW_DEBUG_SCENARIOS=1`.
- **`game/server/test/debug-gate.test.js`**
  - Add `allows socket with IPv4-mapped loopback address (::ffff:127.0.0.1)`.
- **Context (no change required unless broken):**
  - `harness/screenshot.mjs` already appends the world-stage steps
    (`emitScenario sunken-canyon-stage`, before/after screenshots and probes)
    for this ticket via `isWorldStageTicket` detection.
  - `game/server/debugScenarios.js` `sunken-canyon-stage` branch already
    generates the layout and emits `questUpdate`; the normal gameplay equivalent
    is deploying the `canyon_descent` quest (`layoutProfile: 'sunken-canyon'`).
  - Do **not** modify sub-ticket folders 01–05 (`.passed`).

## Verification: code
