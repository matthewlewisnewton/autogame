# Server: per-lobby debug TIME_SCALE state + SET_DEBUG_TIME_SCALE socket handler (gated)

Add a debug-only, per-lobby time-scale value to game state and a socket message
to set it, gated by the exact same `isDebugScenarioAllowed(socket)` check that
guards god mode and debug scenarios. This is the server foundation; later
sub-tickets consume the stored value and add the client UI.

## Acceptance Criteria
- A new client→server event `SET_DEBUG_TIME_SCALE` and a server→client result
  event `DEBUG_TIME_SCALE_RESULT` exist in `shared/events.json` (with the
  existing camelCase wire-name convention) and are reachable via the
  `CLIENT_TO_SERVER` / `SERVER_TO_CLIENT` maps in `shared/events.js`.
- Fresh game state created by `createGameState()` includes a `debugTimeScale`
  field defaulting to `1` (normal speed), so every lobby starts un-slowed.
- The `SET_DEBUG_TIME_SCALE` handler:
  - When `isDebugScenarioAllowed(socket)` is false, does NOT mutate any state
    and emits `DEBUG_TIME_SCALE_RESULT` `{ ok: false, reason: <string> }`.
  - When allowed, reads `data.scale`, clamps/validates it to the range
    `[0, 1]` (rejecting non-finite values), stores it on the player's lobby
    state (`lobby.state.debugTimeScale`), and emits
    `DEBUG_TIME_SCALE_RESULT` `{ ok: true, scale: <clamped number> }`.
  - Setting the scale only affects the caller's own lobby state — no other
    lobby's `debugTimeScale` changes.
- The current `debugTimeScale` is included in the lobby `stateSnapshot()` (so
  the client and harness can read the authoritative active scale).

## Technical Specs
- `game/shared/events.json`: add `"SET_DEBUG_TIME_SCALE": "setDebugTimeScale"`
  under the client→server section and
  `"DEBUG_TIME_SCALE_RESULT": "debugTimeScaleResult"` under the server→client
  section, mirroring the existing `TOGGLE_DEBUG_GODMODE` /
  `DEBUG_GODMODE_RESULT` entries.
- `game/server/game-state.js`: add `debugTimeScale: 1` to the object returned
  by `createGameState()`.
- `game/server/socketHandlers/lobbyHandlers.js`: register a
  `socket.on(CLIENT_TO_SERVER.SET_DEBUG_TIME_SCALE, ...)` handler immediately
  after the existing `TOGGLE_DEBUG_GODMODE` handler. Reuse the
  `isDebugScenarioAllowed` import (already present) for gating and
  `withLobbyPlayer` to reach the lobby/state. Clamp via
  `Math.max(0, Math.min(1, scale))` after a `Number.isFinite` guard.
- `game/server/progression.js` (`stateSnapshot()`, ~line 3547): include
  `debugTimeScale: <gameState>.debugTimeScale ?? 1` in the snapshot object,
  using the same state reference the function already reads from.
- Do NOT change simulation math here — only state, the event, and the handler.

## Verification: code
