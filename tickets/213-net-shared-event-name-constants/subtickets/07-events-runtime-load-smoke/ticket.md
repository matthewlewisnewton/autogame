# Runtime load smoke: shared event registry works end-to-end

The shared event-name registry (`game/shared/events.json`) is now adopted on both
the server and client, but the previous round produced no clean captured run —
`metrics.json` came back `ok: false` / `capture_failed` because the whole
`pnpm run dev` process tree went away mid-run (`ERR_CONNECTION_REFUSED` at
`http://localhost:5173/`, both ports empty at diagnosis). This sub-ticket makes
the game boot and load cleanly so the happy-path run actually exercises the
event registry (lobby/state events flowing between server and client). The
codebase is already healthy (all `EVENTS.*` keys resolve, every touched file
passes `node --check`, `pageerrors.json` was empty), so no broad code change is
expected — only a minimal, targeted fix if the run surfaces a genuine
load-blocking defect.

## Acceptance Criteria

- The client loads at `http://localhost:5173/` without `ERR_CONNECTION_REFUSED`
  and the auth/lobby UI renders.
- Two players can connect and appear together in the running game (the
  `init` / `stateUpdate` / lobby events delivered via the shared registry are
  visibly driving the UI — players see each other / the lobby roster).
- WASD movement of the local player is visible in the running game.
- No connection-refused or page errors appear during the happy-path run; the
  Vite dev server stays reachable through page load.

## Technical Specs

- Files under `game/`: do NOT change application logic. The six prior
  sub-tickets (registry extraction + client/server adoption + drift guards) all
  passed; `shared/events.json` and the `EVENTS.*` usages in
  `client/main.js`, `client/renderer.js`, `client/characterBooth.js`,
  `server/index.js`, `server/progression.js`, `server/cardEffects.js`,
  `server/keyItemEffects.js`, `server/debugScenarios.js` are correct.
- The keep the diff empty unless the captured run reveals a concrete,
  reproducible load blocker (e.g. a startup-time throw that takes down the dev
  server). If and only if such a blocker is found, apply the smallest possible
  fix in the offending `game/` file and document it.
- Confirm the event registry path is intact: `EVENTS` is imported from
  `../shared/events.json` on the client and `require('../shared/events.json')`
  on the server, and the dynamic-emit (`runComplete`/`runFailed`) and
  `.once`/`.off` listener helpers resolve to registry constants (already
  covered by the drift-guard test).

## Verification: visual
