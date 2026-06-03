# Automated test for key-item-cooldown debug scenario

The `key-item-cooldown` entry in `DEBUG_SCENARIOS` sets up a playing run with an active key-item cooldown for manual QA, but nothing in the test suite asserts that setup. Add coverage so regressions in `applyDebugScenario` are caught.

## Acceptance Criteria

- A socket/integration test emits `debugScenario` with `{ name: 'key-item-cooldown' }` (with debug scenarios allowed — set `process.env.ALLOW_DEBUG_SCENARIOS = '1'` in the test if the harness connection is not already local-allowed).
- After a successful `debugScenarioResult`, lobby state has `gamePhase === 'playing'`.
- The applying player's `keyItemCooldownUntil` is greater than `Date.now()` (and `equippedKeyItemId` is `dodge_roll` per the scenario branch in `applyDebugScenario`).
- `pnpm test` (or the server test subset that includes the new file) passes.

## Technical Specs

- **`game/server/test/key-items.test.js`** or **`game/server/test/debug-scenarios.test.js`** (new file is fine if it keeps the test focused) — Follow existing debug-scenario patterns: `startTestServer`, `connectClient`, `waitForEvent(socket, 'debugScenarioResult')`, `socket.emit('debugScenario', { name: 'key-item-cooldown' })`. Assert `result.ok` and read player via `playerForSocket(socket)` or `testGameState().players[socket._playerId]`.
- **`game/server/index.js`** — No change expected unless the scenario branch is broken; re-read the `name === 'key-item-cooldown'` block (~line 961) when implementing assertions. Do not modify completed subticket `01`/`02` work.

## Verification: code
