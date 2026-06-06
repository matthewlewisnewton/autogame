# Harness capture: keep game server listening through gameplay

Round-1 top-level review capture failed with `metrics.json` `"ok": false` / `failure_kind: "capture_failed"`: the harness started the game server on port 3004 and two players connected, but the backend stopped listening before the capture reached gameplay — Vite logged repeated `connect ECONNREFUSED 127.0.0.1:3004`, the browser hit 502s on `/socket.io`, and `page.waitForFunction` timed out. Diagnose why the server process becomes unavailable mid-capture and fix it so the standard two-client harness capture completes reliably.

## Acceptance Criteria

- On a harness capture with a non-default port pair (e.g. game `3004` / Vite `5177`), `server.log` shows `Server listening on port <port>` and the process remains bound through the full capture; diagnosis `port_holders[<port>]` is non-empty while capture is in progress (not only at boot).
- After Vite logs `[vite] Game server ready at …`, `client.log` and `console.log` contain **no** `connect ECONNREFUSED 127.0.0.1:<port>` and no repeated `/socket.io` / `/api/register` / `/api/login` proxy 502 errors through the ready→playing transition.
- The standard two-client fallback capture completes: `metrics.json` has `"ok": true`, `pageerrors` is empty, probes show `connectionState: "connected"`, `phase: "playing"`, and `hasCanvas: true`, and at least the movement/dodge screenshots from the fallback recipe are present (not stuck at `01-initial.png`).
- `GET /healthz` continues to return `503` until `startServer()` finishes mounting routes/handlers, then `200 { ok: true }`; harness readiness must not flip true while the HTTP server is not actually accepting connections.
- `cd game && pnpm test:quick` passes with no regressions.
- Do **not** modify passed sub-tickets 01–04 or their artifact trees.

## Technical Specs

- **`game/server/index.js`**
  - Primary investigation target per round-1 review: find why the game-server process stops accepting connections after boot on harness-allocated ports (evidence: `Server listening on port 3004`, two `Player connected` lines, then empty `port_holders["3004"]` with no `[server] uncaughtException` / `unhandledRejection` in `server.log`).
  - Audit `startServer()` boot order, `server.listen`, socket handler registration, lobby deploy/ready paths, and `_harnessReady = true` timing — ensure no silent exit, double-listen crash, or post-ready teardown during the first deploy.
  - If socket/lobby handlers can throw synchronously on connect or ready-up, harden those paths so a single bad payload cannot tear down the process during capture.
  - Keep existing `installMainProcessErrorHandlers()` behaviour for `require.main === module`.
- **`game/client/vite.config.js`**
  - Only if needed: ensure `waitForGameServerReady()` stability probes (`stableProbes` / `stableGapMs`) cannot race ahead of a crashing/restarting server; keep `resolveGameServerProxyTarget()` precedence (`HARNESS_GAME_PORT` → `PORT` → `3000`) and `127.0.0.1` target unless a concrete resolution bug is found.
- **`harness/steps/game.py`**
  - Only if the root cause is harness lifecycle (e.g. `stop_game` / `wait_port_free` killing a still-active capture server, or tracked-PID leaks): fix port-scoped teardown so parallel workers and sub-ticket QA captures cannot terminate another capture's backend mid-run.
- **Context:** round-1 artifacts at `tickets/280-playthrough-validate-spire-ascent/round-1/{metrics.json,console.log,client.log,server.log}`; Spire Ascent validation artifacts under `game/validation/spire-ascent/` already pass `pnpm validate:spire-ascent:check` — this sub-ticket closes only the top-level capture gate.

## Verification: code
