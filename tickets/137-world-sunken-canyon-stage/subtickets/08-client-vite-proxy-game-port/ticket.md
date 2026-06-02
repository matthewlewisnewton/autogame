# Client Vite proxy uses dynamic game port

When the harness game server binds a non-default port, the Vite dev server must proxy `/api` and `/socket.io` to that port via environment variables—not a hardcoded `localhost:3000`.

## Acceptance Criteria

- `game/client/vite.config.js` derives `gamePort` from `Number(process.env.HARNESS_GAME_PORT || process.env.PORT || 3000)` (finite, positive; otherwise fall back to `3000`).
- Both `/api` and `/socket.io` proxy entries set `target` to `` `http://localhost:${gamePort}` `` (no hardcoded `3000` in `target`).
- With neither `HARNESS_GAME_PORT` nor `PORT` set, config still targets port `3000` (backward compatible for `pnpm run dev`).
- `game/client/test/vite-proxy-port.test.js` (or equivalent) asserts default port `3000` and that `HARNESS_GAME_PORT` / `PORT` override the resolved port.
- `pnpm test:quick` (or client vitest scope) passes including the new/updated proxy-port test.

## Technical Specs

- **`game/client/vite.config.js`**: export a small `resolveGamePort(env)` helper if useful for tests; set `const gamePort = resolveGamePort()` at config load; wire both proxies to `` `http://localhost:${gamePort}` ``. Do not use a `router` callback or `.dev-game-port` side file—static `target` only (Vite 8 does not apply `router` the way older docs suggest).
- **`game/client/test/vite-proxy-port.test.js`**: import `resolveGamePort` and test unset env, `PORT`, and `HARNESS_GAME_PORT` precedence.
- **Out of scope for this sub-ticket**: `harness/steps/game.py`, `game/server/index.js`.

## Verification: code
