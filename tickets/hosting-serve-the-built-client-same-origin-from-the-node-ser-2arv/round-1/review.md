# Senior Review — Hosting: serve the built client same-origin from the Node server in production

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block, no `failure_kind`.
- `console.log`: no `pageerror` / `[fatal]` lines. The scene initializes (`[initScene] Initializing Three.js scene...`), both players ready up and reach `phase: "playing"`. The lone `409 (Conflict)` line is a pre-existing lobby-create race unrelated to this ticket — the run proceeds straight into gameplay (probes show movement, dodge with cooldown HUD, and HP changes).
- The capture is the deterministic full-flow smoke (auth → lobby → ready → movement → dodge). The game starts and loads cleanly.

Gate **passes**.

## Per-criterion findings

**AC: In production mode the server serves the built client (index.html + hashed assets) same-origin with SPA fallback, and /api + /socket.io still work; dev unchanged; a test verifies the static route serves index.html and does not shadow /api.**

Met. The implementation in `game/server/index.js:1804-1828`:

- **Production-gated**: the entire static block is guarded by `process.env.NODE_ENV === 'production'`, so dev (Vite proxy) behavior is completely untouched. ✓ (dev unchanged)
- **Same-origin static serving**: mounts `express.static(clientDist)` on the same Express `app`/HTTP server that hosts `/api` and Socket.IO. ✓
- **SPA fallback**: a middleware rewrites `req.url` to `/index.html` for any non-`/api` path that doesn't resolve to an existing file (or resolves to a directory), placed *before* `express.static`, so unknown client routes serve the SPA shell. ✓
- **/api not shadowed**: the fallback explicitly skips `/api` paths, and — more importantly — the static block is mounted *after* the `/api`, `/admin`, and `/healthz` route handlers (`index.js:1791-1802`, plus `/healthz` at `index.js:94`), so real routes win by middleware order. `/socket.io` is intercepted by Socket.IO's own request handler before Express, so it is unaffected. ✓
- **Graceful missing-build handling**: if `client/dist` doesn't exist, it logs a warning and skips static serving rather than crashing — sensible for environments where the build step hasn't run. ✓
- **Idempotent mount**: a dedicated `_staticMounted` guard (separate from `_routesMounted`) prevents duplicate middleware stacking across repeated `startServer()` calls. ✓
- **Test coverage**: `game/server/test/hosting-static-serve.test.js` forces `NODE_ENV=production`, mounts a mock `dist/index.html`, and verifies: `GET /` → 200 HTML containing `<title>Void Grimoire`; `GET /foo` → SPA fallback (200 HTML); `GET /healthz` → JSON `{ ok: true }` (not HTML); `GET /api/some-path` → non-HTML (not the SPA shell). I ran the suite locally: **4 passed**. ✓

## Consistency / regression

- Change is additive and isolated to `game/server/index.js` plus a new test file (`git diff --stat`: 29 lines in index.js, new test, two sub-ticket docs). No game logic, no client code, no design/requirements regression.
- No debug scenarios were added or changed by this ticket.
- Path traversal is not a new concern: the fallback only *decides* whether to rewrite to index.html via `fs.existsSync`; the actual file serving is delegated to `express.static`, which carries its own `..` protection.

## Remaining gaps

None blocking. (See `nits.md` for one minor test-hygiene follow-up.)

VERDICT: PASS
