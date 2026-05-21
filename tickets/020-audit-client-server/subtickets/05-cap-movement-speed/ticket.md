# Cap Movement Speed — Remove Tolerance Multiplier

The server multiplies the per-tick movement distance cap by `MOVE_SPEED_TOLERANCE` (1.5), allowing a modified client that sends oversized `dx/dz` vectors to move at up to 18 units/s instead of the declared maximum of 12 units/s. Because the client now normalizes its input to magnitude ≤ 1, the tolerance multiplier is unnecessary — the server should defensively normalize the input vector and cap applied distance to exactly `MOVE_SPEED * cappedElapsed` (with only a tiny numeric epsilon for floating-point drift).

## Acceptance Criteria
- The server normalizes incoming `dx`/`dz` to a unit vector (magnitude ≤ 1) before applying `MOVE_SPEED`, so a malicious oversized vector cannot produce extra distance.
- The maximum applied distance per tick is `MOVE_SPEED * cappedElapsed` (no tolerance multiplier), plus at most a small numeric epsilon (≤ 0.01).
- `MOVE_SPEED_TOLERANCE` is removed from `config.js` and no longer imported or used in `index.js`.
- Normal movement (normalized input at TICK_RATE frequency) is unaffected — accepted with the same result as before.
- The existing integration test for `MOVE_SPEED` with capped elapsed is updated to assert the new cap (without the 1.5× tolerance factor).

## Technical Specs
- **File**: `game/server/config.js` — Remove `MOVE_SPEED_TOLERANCE` from the constant declaration and from `module.exports`.
- **File**: `game/server/index.js` — In the `socket.on('move', ...)` handler:
  1. After validating `data.dx`/`data.dz` are finite, normalize the input vector:
     ```js
     const mag = Math.hypot(data.dx, data.dz);
     if (mag > 1) { data.dx /= mag; data.dz /= mag; }
     ```
  2. Remove the `maxDist` / tolerance capping block (lines ~1323-1328 that compute `maxDist = MOVE_SPEED * cappedElapsed * MOVE_SPEED_TOLERANCE` and scale down).
  3. Remove `MOVE_SPEED_TOLERANCE` from the import statement at the top.
- **File**: `game/server/test/integration.test.js` — Update the elapsed-cap test (around line 2701) that asserts `MOVE_SPEED * (MAX_ELAPSED_MS / 1000) * 1.5` to assert `MOVE_SPEED * (MAX_ELAPSED_MS / 1000)` without the `* 1.5` factor.
- **No other files changed.** Do not modify client code, dungeon generation, or enemy AI.

## Verification: code
