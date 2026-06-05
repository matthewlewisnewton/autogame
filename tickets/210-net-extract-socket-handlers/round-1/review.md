## Runtime health

PASS. The captured run in `metrics.json` reports `ok: true`, no server startup failure, and an empty `pageerrors` array. `console.log` contains Vite connection lines, two 409 resource messages, and normal scene initialization logs; it has no `pageerror` or `[fatal]` entries from game code. The probes show a two-player lobby, ready transition into gameplay, movement, and dodge-roll key-item cooldown state.

## Acceptance criteria

1. Move per-event handlers into `game/server/socketHandlers/*` modules exporting `register(socket, ctx)`: PASS. The live event registrations now live in `lifecycle.js`, `lobby.js`, `deck.js`, `trade.js`, `keyItem.js`, and `run.js`, and each module exports a `register(socket, ctx)` function.

2. Shrink the connection handler to building context and registering handlers: PASS. `game/server/index.js` now imports `createSocketHandlerCtx`/`registerAll`, builds a per-connection context with identity plus helper dependencies, and calls `registerAll(socket, ctx)`. The remaining connection logic is authentication/session/bootstrap behavior that belongs at connection setup.

3. Delete dead `buyShopCard` and `listKeyItems` socket handlers when unused by the client: PASS. There are no client emitters for either event and no remaining server socket registrations for those event names. The underlying `buyShopCard` progression function remains exported and unit-tested, which is appropriate because only the dead socket event was removed.

4. Extract `notifyPlayerRemoved()` for repeated leave/eviction broadcast logic: PASS. `notifyPlayerRemoved(lobby, playerId, result)` centralizes the repeated `playerDisconnected` emission plus surviving-lobby update/terminal-state handling, and both disconnect-grace eviction and explicit lobby leave call it.

5. Behavior-preserving with server tests green: PASS. `coverage.log` shows the server test run completed successfully with `42` test files and `927` tests passing. The specifically relevant integration and key-item suites passed, and the capture exercised lobby creation/join, ready/start, movement, and `useKeyItem` behavior without browser errors.

## Design and requirements consistency

PASS. The implementation is a server architecture refactor and does not alter the core lobby/dungeon/card-combat loop described in `game/docs/design.md`. It preserves the foundational requirements in `game/docs/requirements.md`: the browser connects via WebSocket, multiplayer state is present, the 3D scene initializes, and movement/key-item interactions still work in the captured run.

## Debug scenarios

PASS. This ticket did not add a new `?debugScenario=NAME` flow. Existing debug-scenario event handling was moved into `socketHandlers/lifecycle.js`, remains gated by `isDebugScenarioAllowed(socket)`, and normal gameplay paths for lobby creation, ready-up, movement, card use, and key-item use remain available and exercised by tests/capture.

## Code quality

PASS. The refactor follows the existing CommonJS/server style, keeps shared helpers in `index.js` where the surrounding stateful server APIs already live, and passes the existing test suite. No dead socket registrations or obvious broken exports remain.

## Remaining gaps

None.

VERDICT: PASS
