# Senior Review — Client: split main.js bindSocketHandlers into handler registration groups

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure`, no `failure_kind`.
- `console.log`: only two benign `409 (Conflict)` resource lines (lobby create/join race during the dual-client smoke); no `pageerror`, no `[fatal]`, no uncaught exception from game code.
- Live capture probes show the game reaching `phase: "playing"` with two connected players, scene initialized, canvas present, HUD populated, and — critically — the STATE_UPDATE-driven systems working end to end: HP updates (60→40), cooldown HUD counting down (378ms → "0.4" → "0.0"), key-item indicator toggling `keyItemIndicatorOnCooldown`, and movement/prediction all live.

The game starts and loads cleanly. Gate passed.

## Acceptance Criteria

**AC: bindSocketHandlers delegates to per-domain registration modules sharing a context object; no behavior change (existing main/socket tests pass).** — MET.

- `bindSocketHandlers` (game/client/main.js:1436) is now a thin dispatcher that calls eight per-domain registrars: `bindConnectionHandlers`, `bindInitHandlers`, `bindLobbyBrowserHandlers`, `bindStateHandlers`, `bindCardHandlers`, `bindLobbyHandlers`, `bindRunHandlers`, `bindDebugHandlers` — each passed the socket and a single shared `socketHandlerCtx`.
- The shared context is built once via `createSocketHandlerCtx` (game/client/socketHandlers/socketHandlerCtx.js). Mutable module-level state (`myId`, `gameState`, `latency`, deck/inventory/currency, layout, dash/cooldown trackers, etc.) is exposed through getters/setters wired back to main.js's live variables, so handlers always read/write current values rather than stale snapshots. This faithfully follows the existing `cardRenderCtx` pattern the ticket asked for.
- The heaviest handler, STATE_UPDATE (~210 lines), is extracted verbatim into `stateHandlers.js`: phase transitions, HUD sync, hand reconciliation, client-prediction reconciliation, dash VFX detection, and key-item cooldown HUD are all preserved with identical logic and ordering. The live capture is direct proof these still fire.
- No behavior change: the full suite (`260 test files, 3717 tests`) passes, including the server socket integration tests and client main/socket tests.
- `grep` confirms **zero** remaining `s.on(`/`socket.on(` registrations in main.js — every listener was relocated, no duplicated or dead inline handler left behind.

## Consistency with design / no regression

- This is a pure structural refactor of client socket-handler registration; no gameplay rules, server logic, or `shared/` schema changed. `game/docs/design.md` and `requirements.md` foundations are untouched. The diff is confined to main.js (net −931 lines) plus the new `socketHandlers/` modules and sub-ticket bookkeeping.

## Debug scenarios

- No new `?debugScenario=NAME` URL shortcut was added or changed. `debugHandlers.js` only relocates the existing `DEBUG_SCENARIO_RESULT` / `DEBUG_GODMODE_RESULT` *result* listeners (and re-applies godmode mirroring to keep probes consistent). The debug-shortcut review criteria do not apply; nothing bypasses normal-play invariants.

## Code quality

- Clean, idiomatic split matching the codebase's existing context-object convention. Each module imports only what it needs; `index.js` re-exports the registrars. The STATE_UPDATE extraction preserves comments and edge-case handling (hub-layout floor sampling, desperation deck sync, prediction drift thresholds).
- No obvious bugs, no broken imports (tests would have failed otherwise), no console errors in the capture.

## Remaining gaps

None blocking. The acceptance criterion is fully and robustly met, the game runs cleanly, and the entire test suite passes. Minor non-blocking observations are recorded in `nits.md`.

VERDICT: PASS
