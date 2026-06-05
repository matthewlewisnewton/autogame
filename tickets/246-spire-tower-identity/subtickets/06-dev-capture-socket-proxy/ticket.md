# Dev capture: keep Socket.IO reachable through Vite

Round-1 review capture failed with repeated `/socket.io` 502 proxy errors and
`ECONNREFUSED` in `client.log` while the game server listened on the harness
allocated port (e.g. 3001). Harden the dev proxy and server readiness so the
harness capture can auth, connect sockets, and reach gameplay without timing
out.

## Acceptance Criteria

- `game/client/vite.config.js` proxies `/socket.io` and `/api` to the harness
  allocated backend port (`HARNESS_GAME_PORT`, falling back to `PORT` then
  `3000`) using a **runtime-resolved** target (e.g. `configureServer` or
  `loadEnv`) so parallel workers on non-default ports never proxy to the wrong
  host.
- Vite proxy entries include `ws: true` for `/socket.io` and `changeOrigin:
  true` for both `/socket.io` and `/api`.
- `game/server/index.js` exposes `GET /healthz` returning HTTP 200 with a small
  JSON body (e.g. `{ ok: true }`) on the same HTTP server that hosts Socket.IO.
- A harness capture on a non-default port pair (e.g. game `3001` / vite `5174`)
  produces `metrics.json` with `"ok": true`, `pageerrors.json` empty, and
  **no** `/socket.io` 502 or `ECONNREFUSED` lines in `client.log` /
  `console.log`.
- Capture probes show `connectionState: "connected"` and gameplay phase reached
  (e.g. `phase: "playing"`, `hasCanvas: true`, `lobbyVisible: false`).
- Existing unit tests stay green; add or extend tests covering `/healthz` and
  the vite proxy target resolution if practical.

## Technical Specs

- **`game/client/vite.config.js`**
  - Replace the static top-level `apiTarget` constant with a helper that reads
    `HARNESS_GAME_PORT` / `PORT` at dev-server startup (Vite `loadEnv` and/or
    `configureServer` proxy middleware).
  - Keep existing `publicDir`, `server.port`, and `strictPort` behaviour
    unchanged for normal `pnpm run dev`.
  - Proxy `/socket.io` with `{ target, ws: true, changeOrigin: true }` and
    `/api` with `{ target, changeOrigin: true }`.
  - Optionally log the resolved proxy target once at Vite startup for capture
    diagnosis.
- **`game/server/index.js`**
  - Register `app.get('/healthz', …)` **before** `server.listen`, returning
    `200` + `{ ok: true }` (no auth required).
  - Keep `listenPort` resolution (`process.env.PORT || 3000`) unchanged; do not
    alter gameplay/socket handler logic.
- **`game/server/test/`** (if a natural home exists, e.g. integration or
  server index tests)
  - Assert `GET /healthz` returns 200 on a test server instance.
- **Context:** `harness/steps/game.py` already passes `PORT` to the server and
  `HARNESS_GAME_PORT` to Vite; this sub-ticket fixes the game-side wiring so
  those env vars are honoured reliably end-to-end during capture.

## Verification: code
