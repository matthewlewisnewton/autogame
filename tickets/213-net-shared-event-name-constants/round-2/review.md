## Runtime health

FAIL. The captured run is not valid proof that the game starts and loads cleanly. `metrics.json` exists, but it reports `"ok": false` with `failure_kind: "capture_failed"`. `console.log` records `page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/`, and `screenshot.log` shows the fallback capture never produced screenshots or probes.

`pageerrors.json` is empty and there are no `[fatal]` or `pageerror` entries from game code in `console.log`. The client and server logs show Vite and the Node server reached their ready messages, but because the browser capture still failed to load the page, the ticket cannot pass under the runtime-health gate.

## Acceptance criteria

Criterion 1: add a shared canonical event registry used by both sides.

PASS on code inspection. `game/shared/events.json` defines the socket event vocabulary, server modules import it via `require(...)`, and client modules import it from `../shared/events.json`. The changed production call sites in `game/server/index.js`, `game/server/progression.js`, `game/server/cardEffects.js`, `game/server/keyItemEffects.js`, `game/server/debugScenarios.js`, the server socket handler modules, and the client entry/renderer/booth modules now use `EVENTS.*` for gameplay socket events.

Criterion 2: replace duplicated event literals incrementally without changing behavior.

PASS on code inspection. The changes are mechanical substitutions of event-name strings with shared constants. The remaining raw production socket names are Socket.IO or Node lifecycle hooks such as `connect`, `disconnect`, `connect_error`, `reconnect`, `connection`, `error`, `uncaughtException`, and `unhandledRejection`; those are appropriately outside the gameplay event registry. Dynamic emit paths such as phase-mismatch payloads and quest updates now pass registry constants instead of raw string event names.

Criterion 3: add a drift guard test.

PASS on captured test evidence. `coverage.log` shows `server/test/event_name_drift.test.js` passing 5 tests, with the full suite at 80 passed files and 1331 passed tests. The drift guard statically scans the relevant server/client production files for `.emit`, `.on`, `.once`, `.off`, and raw `event:` / `event =` dynamic-emit literals, then verifies raw gameplay literals are absent, every `EVENTS.<name>` reference exists in the registry, and every registry key is referenced.

## Design and foundation

The event-name registry is consistent with the existing client/server architecture described in `CONTEXT.md` and does not alter gameplay design from `game/docs/design.md`. It preserves the WebSocket-based server-client foundation required by `game/docs/requirements.md` by centralizing wire event names rather than changing message flow or gameplay state.

## Debug scenarios

This ticket did not add or materially change debug scenario end states. The existing `?debugScenario=...` client path remains gated to local hostnames, and the server still checks `isDebugScenarioAllowed(socket)` before applying a scenario. The event-name changes only route `debugScenario` and `debugScenarioResult` through the shared registry.

## Code quality and tests

The production event substitutions are scoped and readable. The static drift guard is intentionally text-based, so it avoids importing browser modules into Vitest while still covering the relevant socket vocabulary. I did not find dead or broken code in the event-registry implementation.

## Remaining gaps

1. Captured runtime proof is missing: `metrics.json` reports `"ok": false` and the browser failed to load `http://localhost:5173/` with `net::ERR_CONNECTION_REFUSED`. No screenshots or probes were captured, so the game has not been proven to start and load cleanly with this ticket applied.

VERDICT: FAIL
