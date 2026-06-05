# 04 — Harness capture: keep game server reachable

Round-1 top-level review capture failed with `metrics.json` `"ok": false` / `failure_kind: "capture_failed"`: Vite reported the game server ready at the harness-allocated port, but browser auth/socket traffic then hit repeated `502` / `ECONNREFUSED 127.0.0.1:<port>` and `port_holders[<port>]` was empty. Fix dev/harness startup so the backend stays listening and proxyable for the full two-client capture.

## Acceptance Criteria

- On a harness capture with a non-default port pair (e.g. game `3003` / Vite `5176`), `server.log` ends with the process still listening (`Server listening on port <port>` present; diagnosis `port_holders[<port>]` non-empty when capture completes).
- After Vite logs `[vite] Game server ready at …`, `client.log` and `console.log` contain **no** `connect ECONNREFUSED 127.0.0.1:<port>` or repeated `/socket.io` / `/api/register` / `/api/login` proxy 502 errors.
- The standard two-client capture reaches gameplay: `metrics.json` has `"ok": true`, `pageerrors.json` is empty, and capture probes show `connectionState: "connected"` (not stuck on `"reconnecting"`), `phase: "playing"`, and `hasCanvas: true`.
- `GET /healthz` continues to return `503` until `startServer()` finishes mounting routes/handlers, then `200 { ok: true }`; harness readiness must not flip true while the HTTP server is not actually accepting connections.
- `pnpm test:quick` (from `game/`) passes with no regressions.

## Technical Specs

- **`game/server/index.js`**
  - Find and fix why the game-server process stops accepting connections after boot on harness-allocated ports (round-1 evidence: `Server listening on port 3003` with zero `Player connected` lines, then empty `port_holders["3003"]`). Audit `startServer()` boot order: `server.listen`, persistence/provider init, socket handler registration, and `_harnessReady = true` must leave a stable listener — no silent exit, double-listen crash, or post-ready teardown.
  - Keep existing `installMainProcessErrorHandlers()` behaviour for `require.main === module`; prefer fixing the throw/exit site over masking errors.
  - If socket/lobby handlers can throw synchronously on first connect, guard or harden those paths so a single bad payload cannot tear down the process during capture.
- **`game/client/vite.config.js`**
  - Harden harness capture readiness: `waitForGameServerReady()` should not release the Vite dev server until the backend is **stable** (e.g. consecutive successful `/healthz` probes, or re-check after a short delay) so a fleeting ready response cannot race ahead of a crashing/restarting server.
  - Keep `resolveGameServerProxyTarget()` precedence (`HARNESS_GAME_PORT` → `PORT` → `3000`) and `127.0.0.1` target unchanged unless a concrete resolution bug is found.
  - Export helpers remain testable; add or extend a small unit test if the stability window logic is non-trivial.
- **Do NOT modify** passed sub-tickets 01–03, `harness/` (unless a one-line env pass-through bug is proven and unavoidable), or `review-feedback.md` / `round-1/review.md`.
- **Context:** round-1 `metrics.json` `capture_diagnosis` shows Vite ready then immediate `ECONNREFUSED`; sub-ticket 03's own capture later succeeded — the top-level gate still needs a deterministic fix, not a flake workaround.

## Verification: code
