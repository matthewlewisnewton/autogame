# Senior Review: 210-net-extract-socket-handlers

## Runtime health
The captured game run is healthy. `metrics.json` reports `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `pageerrors.json` is empty. `console.log` contains Vite connection logs plus expected 409 registration conflicts from the harness flow, but no `pageerror` or `[fatal]` entries from game code. The screenshots and probes show the lobby flow, ready transition, gameplay, movement, and key-item cooldown HUD working with two connected players.

## Acceptance criteria

1. Move per-event handlers into `game/server/socketHandlers/*` modules exporting `register(socket, ctx)`.

   Pass. The socket events now live in focused modules for lobby, deck/progression, key items, trades, run actions, and miscellaneous/debug/disconnect handling. Each module exports `register(socket, ctx)`, and the context object carries the requested identity and helper dependencies, including lobby lookup, lobby updates, socket lookup, persistence, and related connection helpers.

2. Shrink the connection handler to building context and calling registers.

   Pass. The `io.on('connection')` body now authenticates from socket data, builds/restores the session player, creates the socket context, calls each handler module's `register`, handles reconnect/init emission, and broadcasts the lobby list. The large inline event-handler body has been removed from `game/server/index.js`.

3. Delete dead `buyShopCard` and `listKeyItems` socket handlers after confirming no client emitter; extract `notifyPlayerRemoved()`.

   Pass. `buyShopCard` remains available as a progression function and unit-tested behavior, but there is no client `socket.emit('buyShopCard')`. `listKeyItems` has no client emitter, and the client receives key-item definitions through `init`. The repeated leave/eviction removal broadcast logic is centralized in `notifyPlayerRemoved(lobby, playerId)`.

4. Preserve behavior and keep the server test suite green.

   Pass. The captured `coverage.log` reports `42 passed` test files and `927 passed` tests. The changed integration/key-item areas are covered by the existing server suite, and the full-flow browser capture exercises lobby creation/joining, ready transition, movement, card UI, and key-item use after the extraction.

## Design and requirements
The implementation is consistent with the documented client/server architecture and multiplayer lobby-to-dungeon loop. It does not change the core gameplay design, persistence model, movement synchronization, or WebSocket connection requirements; it only decomposes server socket wiring while preserving the existing event surface used by the client.

## Debug scenarios
No new development debug scenario was added by this ticket. The existing `debugScenario` socket event was moved into `miscHandlers` and remains gated by `isDebugScenarioAllowed(socket)` with the URL/debug path still handled outside normal gameplay.

## Code quality
The extraction keeps shared state-sensitive progression and simulation calls inside `withLobbyContext`/`withLobbyFromSocket`, which preserves the existing lobby-scoped behavior. The remaining connection-time helpers stay in `index.js`, while per-event logic is now easier to review and less likely to cause merge conflicts. I did not find dead or broken code in the moved handlers, and the live run has no browser exceptions.

## Remaining gaps
None.

VERDICT: PASS
