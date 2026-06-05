# Drift-guard test for shared event names

Add an automated test that fails if any server emit / client `on` (or vice-versa)
event name drifts away from the shared `game/shared/events.json` registry — i.e.
if someone reintroduces a raw event-name string literal at a socket call site
instead of going through the registry. This is the safety net that makes the
refactor self-enforcing.

## Acceptance Criteria

- A new test (runnable by `pnpm test` in `game/`, e.g. a vitest file under
  `game/server/test/`) exists and passes.
- The test statically scans the server and client socket call sites for the
  first argument of `.emit(...)` and `.on(...)` and asserts that every
  **gameplay** event name resolves to a value present in `game/shared/events.json`
  — i.e. no raw gameplay-event string literal remains at those call sites; they
  must be referenced via the imported registry constant.
- The test maintains an explicit allowlist of non-game lifecycle names that are
  permitted as raw literals (`connection`, `connect`, `disconnect`,
  `connect_error`, `error`, `heartbeat`, `heartbeat_ack` if still raw,
  `uncaughtException`, `unhandledRejection`) so those do not trip the guard.
- The test additionally asserts the registry has no unused dead entries OR,
  alternatively, that the set of names the server emits is covered by the
  registry and the set of names the client listens for is covered by the
  registry (drift in either direction is caught). Document which invariant the
  test enforces in a comment at the top of the file.
- To prove the guard works, the test (or a comment block in it) demonstrates the
  failure mode: introducing a raw literal like `socket.emit('typoEvent', ...)` or
  a registry/usage mismatch would make the test fail.

## Technical Specs

- New test file, e.g. `game/server/test/event_name_drift.test.js`, using the
  existing vitest setup (see sibling files in `game/server/test/`).
- Load the registry with `require('../../shared/events.json')`.
- Scan source files by reading them with `fs.readFileSync` and applying a regex
  over `.emit(` / `.on(` call sites; the set of files to scan must include the
  server files (`game/server/index.js`, `progression.js`, `cardEffects.js`,
  `keyItemEffects.js`, `debugScenarios.js`, `hubPresence.js`,
  `socketHandlers/*.js`) and the client files (`game/client/main.js`,
  `renderer.js`, `characterBooth.js`). Exclude `**/test/**` and `node_modules`.
- The regex should flag a call site whose first argument is a quoted string
  literal that is NOT in the lifecycle allowlist (those should now be
  `EVENTS.<name>` references instead). It does not need to evaluate the modules;
  static text scanning is sufficient and avoids importing client (Vite) modules
  into the Node test runner.
- Depends on sub-tickets 01 and 02 being complete (all real call sites already
  routed through the registry), otherwise the test will (correctly) fail.

## Verification: code
