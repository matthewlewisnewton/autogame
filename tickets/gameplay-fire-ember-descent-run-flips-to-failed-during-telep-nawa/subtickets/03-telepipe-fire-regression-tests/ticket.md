# Telepipe fire regression tests

## Description

Add focused vitest coverage proving the fire preset telepipe-reset path cannot flip a playing run to `'failed'` after portal placement, and that ordinary out-of-cards failure still works without an active portal. Depends on sub-tickets 01 and 02.

## Acceptance Criteria

- `game/server/test/server.test.js` includes (or retains) tests in a `telepipe vs combat exhaustion` block: solo card-exhausted player with active `gameState.telepipe` keeps `run.status === 'playing'` through `checkRunTerminalState` and `tickCombatExhaustionGrace`; `tryEnterTelepipe` + suspend ends in lobby with `suspendedCheckpoint` — not `'failed'`.
- New test in `game/server/test/server.test.js` or `game/server/test/debug-scenarios.test.js`: after `fire-telepipe-ready` lobby ready-up deploy, `gameState.enemies` contains only the harness dummy grunt(s), `player.debugGodmode === true`, and walking onto the placed telepipe suspends instead of failing.
- Regression test: solo player out of cards with **no** `gameState.telepipe` still gets `run.status === 'failed'` immediately via `checkRunTerminalState()`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/test/server.test.js`
  - Import `PORTAL_PLACEMENT_GRACE_MS`, `RUN_EXHAUSTION_GRACE_MS` from `../config.js` if not already in scope.
  - Extend or add `describe('telepipe vs combat exhaustion', …)` using `resetState`, `startDungeonRun`, `addPlayer`, `checkRunTerminalState`, `tickCombatExhaustionGrace`, `tryEnterTelepipe`, and fake timers — mirror patterns around the existing block (~L1920).
- **Edit:** `game/server/test/debug-scenarios.test.js`
  - Add coverage for `fire-telepipe-ready` deploy hooks: `suppressWavesAfterDeploy` active, single dummy enemy, `debugGodmode` set, telepipe suspend path does not set `run.status` to `'failed'`.
  - Use socket `debugScenario` + ready-up deploy patterns from existing `fire-telepipe-ready` lobby test (~L2075).
- **No production code changes** in this sub-ticket (depends on sub-tickets 01 and 02).

## Verification: code
