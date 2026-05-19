# Socket Integration Tests

Write integration tests that spawn a real Socket.IO server, connect mock clients via `socket.io-client`, and verify the end-to-end behavior of the core socket event flow. These tests exercise the full server logic — not just isolated functions — by simulating real client connections.

## Acceptance Criteria
- Tests cover the **connection flow**: a new client connects, receives an `init` event containing `id`, `state`, `layoutSeed`, and `layout`.
- Tests cover the **move event**: a connected client emits `move` with `{x, y, z, rotation}`, and the server broadcasts a `stateUpdate` reflecting the new position; positions are clamped to `[-25, 25]`.
- Tests cover **invalid move rejection**: emitting `move` with missing or non-numeric fields does not update the player's position.
- Tests cover the **useCard event** for all three card types:
  - **Weapon**: emits `useCard`, server processes cone attack and broadcasts `cardUsed`.
  - **Summon**: emits `useCard`, server processes radial AoE and deducts magic stones.
  - **Monster**: emits `useCard`, server spawns a minion in `gameState.minions`.
- Tests cover the **heartbeat event**: client emits `heartbeat`, server responds with `heartbeat_ack` containing latency.
- Tests cover the **disconnect event**: when a client disconnects, the player is removed from `gameState.players` and any owned minions are cleaned up.
- Tests cover the **lobby / playerReady flow**: two players connect, both emit `playerReady(true)`, and both receive `startGame`.
- All tests pass with `npm test` (run from `game/` or `game/server/`).

## Technical Specs
- **Files to create**:
  - `game/server/test/integration.test.js` — integration tests using a real HTTP + Socket.IO server on a random port, with `socket.io-client` as the test client.
- **Files to modify**:
  - `game/server/index.js` — the server currently calls `server.listen(PORT)` at the top level. Refactor the listen call into a function (e.g., `function startServer(port) { server.listen(port, ...); }`) so tests can either prevent auto-listen or create an isolated instance. Add a conditional: do **not** auto-listen when `process.env.TEST_MODE` is set, and export the `startServer` function, `io`, `gameState`, and `resetGameState` for test use.
- **Key detail**: Each integration test should create a fresh server instance (or call `resetGameState`) to avoid test interference. Tests should clean up (disconnect clients, close server) in `afterEach`.

## Verification: code
