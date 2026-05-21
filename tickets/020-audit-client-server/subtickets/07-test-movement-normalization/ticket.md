# Test Server Movement with Normalized Input

Add a server-side integration test that verifies the server correctly applies `MOVE_SPEED` to normalized movement input (magnitude ≤ 1), producing displacement of approximately `MOVE_SPEED * elapsed` per tick.

## Acceptance Criteria
- A new test in `game/server/test/integration.test.js` connects a client, enters playing phase, and emits a `move` event with normalized `dx: 1, dz: 0`.
- The test asserts the server's displacement is approximately `MOVE_SPEED * cappedElapsed` (within a small tolerance of ±0.5 units).
- The test does not depend on real-time sustained movement — it uses a single tick and reads the resulting position.
- All existing tests continue to pass.

## Technical Specs
- **File**: `game/server/test/integration.test.js` — Add one new `it()` block in the existing movement test describe block.
  1. Connect client, use `debugScenario` to enter playing phase.
  2. Record the player's starting `x` position.
  3. Emit `socket.emit('move', { dx: 1, dz: 0, rotation: 0 })`.
  4. Wait a tick (`await sleep(50)`).
  5. Assert `Math.abs(player.x - startX)` is close to `MOVE_SPEED * (MAX_ELAPSED_MS / 1000)` within ±0.5 tolerance.
- **No other files changed.** Do not modify client code, server logic, or config files.

## Verification: code
