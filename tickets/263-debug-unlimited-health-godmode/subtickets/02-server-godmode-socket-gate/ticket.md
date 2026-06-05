# 02-server-godmode-socket-gate

Expose a dev-only socket toggle that flips `player.debugGodmode`, gated by the same hardened `isDebugScenarioAllowed()` check used for debug scenarios (peer-address / env-var gate from ticket 265 — not client Origin/Host headers).

## Acceptance Criteria

- A new socket event `toggleDebugGodmode` toggles `lobby.state.players[socket.playerId].debugGodmode` between `false` and `true`.
- The handler rejects the request (does not change state) when `isDebugScenarioAllowed(socket)` is `false`, and emits `debugGodmodeResult` with `{ ok: false, reason: 'Debug godmode is disabled' }`.
- When allowed, the handler emits `debugGodmodeResult` with `{ ok: true, enabled: <boolean> }` reflecting the new flag value.
- With godmode enabled via the socket toggle, `damagePlayer` leaves HP unchanged (integration-level test using a real socket connection).
- With `NODE_ENV=production` and without `ALLOW_DEBUG_SCENARIOS=1`, a non-loopback peer cannot enable godmode via the socket event.
- `stateSnapshot()` / `hotStateSnapshot()` still omit `debugGodmode` from player payloads.

## Technical Specs

- **`game/server/socketHandlers/lobbyHandlers.js`** — add `socket.on('toggleDebugGodmode', …)` next to the existing `debugScenario` handler (~line 379). Use `isDebugScenarioAllowed(socket)` from `ctx` for the gate (same pattern as `debugScenario`). Resolve the player via `lobbies.getLobbyForPlayer(socket.playerId)` / `withLobbyPlayer` consistent with neighboring handlers.
- **`game/server/index.js`** — no change required if `isDebugScenarioAllowed` is already passed in the lobby handler `ctx` (it is today).
- **`game/server/test/debug-godmode.test.js`** — extend with socket integration tests: connect a test client with `ALLOW_DEBUG_SCENARIOS=1`, enter a run (e.g. `summon-ready` debug scenario), emit `toggleDebugGodmode`, assert `debugGodmodeResult`, then apply damage (direct `damagePlayer` call or enemy strike) and assert HP unchanged. Add a gate-rejection test mirroring `game/server/test/debug-gate.test.js` (non-loopback address, no env override → `ok: false`).
- Reuse `debugGodmode` field and `damagePlayer` guard from sub-ticket 01; do not add client UI here.

## Verification: code
