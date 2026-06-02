# 06 — Vite API proxy matches harness game port

Fix the dev-client proxy so `/api` and `/socket.io` reach the game server on whatever port the harness assigns (`PORT` / `HARNESS_GAME_PORT`), not a hard-coded `3000`.

## Acceptance Criteria

- `game/client/vite.config.js` sets proxy `target` from `process.env.HARNESS_GAME_PORT` or `process.env.PORT`, defaulting to `3000` when neither is set.
- Local `pnpm run dev` (server on 3000, no env override) still proxies successfully to the default backend port.
- When the harness starts the server on a non-default port (e.g. `PORT=3001`), Vite started in the same environment proxies `/api/register` and `/api/login` without `ECONNREFUSED` / `502`.
- A focused unit or config test (or documented harness check) asserts the resolved proxy base URL matches the env port when `HARNESS_GAME_PORT` is set.

## Technical Specs

- **`game/client/vite.config.js`**: derive `const gamePort = Number(process.env.HARNESS_GAME_PORT || process.env.PORT || 3000)` and use `http://localhost:${gamePort}` for both `/api` and `/socket.io` proxy targets.
- **`game/client/test/vite-config.test.js`** (new, if no existing pattern): import or evaluate the config module and assert proxy target includes the port from a stubbed `process.env.HARNESS_GAME_PORT`.
- **`game/server/index.js`**: no behavior change required beyond existing `process.env.PORT` listen logic; only touch if a shared constant is needed for docs/tests.
- Do not change harness Python in this sub-ticket unless vite still cannot see `HARNESS_GAME_PORT` (dispatcher already exports it in worker env).

## Verification: code
