# Harness capture: keep backend alive through squad lobby

Round-1 top-level review capture failed with `metrics.json` `"ok": false`:
the game server stopped accepting connections on the harness-allocated port
(`ECONNREFUSED 127.0.0.1:3003` / Vite `/socket.io` 502s in `client.log`) while
Playwright timed out waiting for `#lobby`. Hub presence features (sub-tickets
01–04) are implemented and unit-tested; this sub-ticket fixes the runtime
stability/sequencing defect so the standard two-client capture reaches the
squad lobby with the backend still listening.

## Acceptance Criteria

- During a harness capture on a non-default port pair, the game server process
  remains bound to the configured `PORT` for the entire run (diagnosis
  `port_holders[<port>]` is non-empty; `server.log` does not end abruptly
  before lobby join completes).
- `client.log` and `console.log` contain **no** `connect ECONNREFUSED
  127.0.0.1:<port>` or repeated `/socket.io` 502 proxy errors after Vite reports
  the game server ready.
- The two-client capture flow reaches the squad lobby: `#lobby` becomes visible
  (screenshot step `01-initial.png` / harness probe `lobbyVisible: true` while
  `phase === 'lobby'`), and both players can auth, create/join a lobby without
  socket disconnect.
- Top-level capture artifacts report success: `metrics.json` has `"ok": true`,
  `pageerrors.json` is empty, and `screenshot.log` has no lobby-visibility
  timeout.
- `pnpm test:quick` (from `game/`) passes with no regressions to hub-presence
  server/client tests.

## Technical Specs

- **`game/server/index.js`**
  - Find and fix the cause of the server process exiting mid-capture after
    socket connections are accepted (round-1 evidence: `Server listening on port
    3003`, two `Player connected` lines, then port holder empty and Vite
    `ECONNRESET`/`ECONNREFUSED`). Likely loci: lobby join/reconnect handlers,
    `emitLobbyJoined` hub-presence snapshot attach, `runGameLoopTick` lobby
    branch (`syncHubPresenceFromLobby` / `emitHubPresenceUpdateIfChanged`), or
    leave/disconnect presence cleanup.
  - Harden hub-presence emit paths so a malformed player/cosmetic record cannot
    take down the process (defensive validation in `hubPresence.js` helpers or
    localized try/catch with `console.error` in `index.js` join/tick/leave
    call sites — prefer fixing the throw site over silencing all errors).
  - Keep `/healthz` and `_harnessReady` behaviour unchanged for harness startup;
    do not alter gameplay semantics outside lobby-phase presence.
- **`game/client/main.js`**
  - Fix `applyLobbyJoinedData` sequencing: assign `gameState = data.state` and
    call `setGameStateRef(gameState)` **before** merging `data.hubPresence`
    (today `setGameStateRef` runs against stale state at the top of the
    function).
  - Ensure lobby UI is shown reliably on lobby-phase join: `showGameLobby()`
    must run and `#lobby` must become visible even when `hubPresence` is
    present; defer `applyHubPresence` until after `showGameLobby()` if the
    presence merge currently races scene/renderer setup.
  - Guard `applyHubPresence` against missing `presence.entries` or partial
    entries so a bad snapshot cannot prevent lobby render.
- **Do NOT modify** `harness/`, retired sub-tickets 01–04 folders, or
  `review-feedback.md` / `round-1/review.md`.
- **Context:** round-1 `metrics.json` `capture_diagnosis.client_log_tail` shows
  repeated `ECONNREFUSED 127.0.0.1:3003`; `screenshot.log` timed out on
  `#lobby`. Sub-ticket 04's own capture later succeeded — the top-level gate
  still needs a deterministic fix, not a flake workaround.

## Verification: code
