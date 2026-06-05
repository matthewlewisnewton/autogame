# 05 — Socket event drift guard test

Add an automated test that fails if production server code emits or listens with a string literal not present in the shared catalog, or if the client listens/emits with an unregistered name. This closes the top-level acceptance criterion: renames/typos cannot silently drop messages.

## Acceptance Criteria

- A vitest file under `game/server/test/` (e.g. `socket_events_drift.test.js`) statically scans configured production paths and asserts every `.emit(` and `socket.on(` first argument that is a string literal equals a value in `game/shared/events.json`.
- The scan includes at minimum: `game/server/{index,progression,cardEffects,keyItemEffects,debugScenarios,hubPresence}.js`, `game/server/socketHandlers/*.js`, and `game/client/main.js` for `s.on` / `socket.emit`.
- Socket.IO built-ins (`connect`, `disconnect`, `connect_error`) are allowlisted and not required in the catalog.
- Introducing a new literal such as `.emit('typoEvent', …)` or `s.on('typoEvent', …)` in those files causes the test to fail.
- The test passes on the codebase after sub-tickets 01–04.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **New:** `game/server/test/socket_events_drift.test.js` — read `events.json`, build `Set` of allowed wire strings per direction; walk files with regex or small parser; fail with a clear file:line listing of offenders.
- **Optional:** extend `game/server/test/events.test.js` to assert catalog count matches scan results (no orphan catalog entries without a production reference is nice-to-have, not required).
- Do not migrate `game/server/test/**` or Playwright scripts in this sub-ticket (tests may keep string literals).

## Verification: code
