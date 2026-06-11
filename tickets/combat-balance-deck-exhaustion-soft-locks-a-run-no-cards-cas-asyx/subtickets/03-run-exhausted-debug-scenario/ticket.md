# Align run-exhausted debug scenario and integration test with MS stall

## Description

The `run-exhausted` debug scenario clears all cards and immediately calls `checkRunTerminalState()`, which does not reproduce the real soft-lock (hand still holds an uncastable MS spell). Update the scenario to mirror the reported Frost Crossing stall and ensure the integration test exercises the new grace-based failure path.

## Acceptance Criteria

- `setupRunExhaustedDebug()` in `game/server/debugScenarios.js` sets each in-dungeon player to: empty `deck`, empty `desperationDeck`, hand with one `battle_familiar` (`magicStoneCost: 50`, `remainingCharges: 1`), and `magicStones` below 50 (e.g. 25); leaves at least one living enemy and an incomplete objective
- The scenario pre-ages exhaustion grace so the debug path still resolves promptly: set each stalled player's `_combatExhaustedSince` to `Date.now() - RUN_EXHAUSTION_GRACE_MS` before calling `checkRunTerminalState()`, or call `tickCombatExhaustionGrace` with a faked clock — the harness must not wait 15–30 real seconds
- `socket1.emit('debugScenario', { name: 'run-exhausted' })` integration test in `game/server/test/integration.test.js` still receives `runFailed` with `status: 'failed'` and `testGameState().run.status === 'failed'`
- New focused unit test in `game/server/test/debug-scenarios.test.js` (or `server.test.js`) asserts the post-setup player state matches the MS-insufficient stall (hand has `battle_familiar`, MS < cost, piles empty)
- Existing `sets status to failed when all players are out of cards` test in `server.test.js` still passes unchanged

## Technical Specs

- **File**: `game/server/debugScenarios.js`
  - Rewrite `setupRunExhaustedDebug` (~line 3092) to populate the MS-insufficient hand instead of wiping all cards
  - Import `RUN_EXHAUSTION_GRACE_MS` from `./config` and use it to back-date `_combatExhaustedSince`
  - Keep the remaining enemy spawn and `checkRunTerminalState()` call at the end
- **File**: `game/server/test/integration.test.js`
  - Update or add assertions on the `run-exhausted` test (~line 2765) if the scenario now requires an extra tick; verify `runFailed` payload still arrives
- **File**: `game/server/test/debug-scenarios.test.js` (preferred) or `game/server/test/server.test.js`
  - Direct unit test calling `setupRunExhaustedDebug` with a minimal lobby/state fixture to assert stall-shaped player fields

## Verification: code
