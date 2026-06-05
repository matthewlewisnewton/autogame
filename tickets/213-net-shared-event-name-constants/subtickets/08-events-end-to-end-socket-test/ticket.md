# End-to-end socket test: shared event registry delivers messages between two real clients

The registry code is complete and all three acceptance criteria passed code
review, but the top-level review captures keep flaking on the *browser* run
(`metrics.json` → `ok: false` / `capture_failed`, `console.log` missing, both
ports empty at diagnosis, no `pageerrors` recorded) — the `pnpm run dev` process
tree dies mid-capture, so there is still no durable proof the game actually
exchanges messages over the shared registry at runtime. Add a deterministic,
Node-level socket integration test that boots a real server, connects two real
`socket.io-client` clients, and asserts core gameplay events (`init`,
`lobbyJoined`, `stateUpdate`) flow end-to-end using ONLY `EVENTS.*` constants —
giving capture-independent, code-verifiable proof that the registry works.

## Acceptance Criteria

- A new test file `game/server/test/event_registry_runtime.test.js` exists and
  is picked up by the existing Vitest server suite.
- The test boots a real server and connects two real `socket.io-client` clients
  (reusing the existing `helpers.js` harness), and asserts BOTH clients receive
  an `EVENTS.init` payload, prove they are in the same lobby via the
  `EVENTS.lobbyJoined` event, and that at least one `EVENTS.stateUpdate` payload
  is delivered to a client after both are connected.
- Every socket event name in the new test is referenced through the shared
  registry constant (`EVENTS.<name>` imported from `../../shared/events.json`) —
  there are NO raw event-name string literals in the listener/emit calls, so a
  future registry rename/typo breaks this test (it co-drifts with the registry).
- The new test passes in the captured `coverage.log` (its describe/it block
  shows as passing for `server/test/event_registry_runtime.test.js`), and it
  does NOT depend on Vite, a browser, or the visual capture pipeline.

## Technical Specs

- New file: `game/server/test/event_registry_runtime.test.js`. Follow the
  conventions of the existing socket integration tests
  (`game/server/test/integration.test.js`,
  `game/server/test/hub_presence_integration.test.js`): Vitest
  `describe/it`, `beforeAll`/`afterAll` (or `beforeEach`/`afterEach`) lifecycle.
- Use the established harness in `game/server/test/helpers.js`:
  `startTestServer()` to boot on an ephemeral port, `connectTwoClients(baseUrl)`
  to get two authenticated clients in one lobby, `waitForEvent(socket, ...)` to
  await deliveries, and `closeServer()` in teardown so no ports/sockets leak.
- Import the registry exactly as production server code does:
  `const EVENTS = require('../../shared/events.json');` (or the ESM-import form
  used by the other server test files). Reference event names ONLY via
  `EVENTS.init`, `EVENTS.lobbyJoined`, `EVENTS.stateUpdate`, etc. — never as raw
  strings — so the assertion that a delivered event matches `EVENTS.<name>`
  proves the server's wire name and the registry agree.
- To force a `stateUpdate` after both clients are connected, drive a normal
  gameplay action the existing tests already use (e.g. emit the registry-named
  movement/ready event that `integration.test.js` relies on) and `waitForEvent`
  for `EVENTS.stateUpdate`. Keep the test hermetic and fast; reuse
  `InMemoryProvider` wiring already set up inside `startTestServer()`.
- Do NOT change any production `game/` source files — the registry adoption is
  already complete and passed review. This sub-ticket only adds a test that
  produces durable, capture-independent runtime proof.

## Verification: code
