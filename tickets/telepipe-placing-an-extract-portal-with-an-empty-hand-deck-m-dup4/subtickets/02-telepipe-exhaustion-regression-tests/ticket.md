# Telepipe exhaustion regression tests

## Description

Add focused vitest coverage for the bug where placing telepipe with a fully depleted hand/deck incorrectly fails the run. Tests must prove the guard from sub-ticket 01 holds through `checkRunTerminalState`, `tickCombatExhaustionGrace`, and the full extract-to-suspend path, while confirming ordinary out-of-cards failure still works without an active portal.

## Acceptance Criteria

- New test in `game/server/test/server.test.js`: solo player in a `'playing'` run with empty `hand`, `deck`, and `desperationDeck`, active `gameState.telepipe` (placedAt within or past `PORTAL_PLACEMENT_GRACE_MS`), `checkRunTerminalState()` and `tickCombatExhaustionGrace()` both leave `run.status === 'playing'`.
- New test: same setup, advance `placedAt` past `PORTAL_PLACEMENT_GRACE_MS`, move player onto portal coords, `tryEnterTelepipe('p1')` succeeds and `maybeSuspendRun()` (or equivalent extract-all flow) ends with `run.status === 'suspended'` and `gamePhase === 'lobby'` — not `'failed'`.
- Regression test: solo player out of cards with **no** `gameState.telepipe`, `checkRunTerminalState()` sets `run.status === 'failed'` (immediate failure, no grace).
- Regression test: MS-insufficient stall without telepipe still fails after `RUN_EXHAUSTION_GRACE_MS` via `tickCombatExhaustionGrace` (existing behavior preserved).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/test/server.test.js`
  - Import `PORTAL_PLACEMENT_GRACE_MS`, `RUN_EXHAUSTION_GRACE_MS` from `../config.js` if not already in scope.
  - Add a `describe('telepipe vs combat exhaustion', …)` block (or extend the existing `'telepipe extract hub return'` / `'combat exhaustion detection'` sections) using `resetState`, `startDungeonRun`, `addPlayer`, `checkRunTerminalState`, `tickCombatExhaustionGrace`, `tryEnterTelepipe`, and fake timers where needed.
  - Reproduce the harness scenario minimally: player at `(0, 0)` or `(5, 5)`, telepipe at player position, hand/deck/desperation all empty after simulated placement (hand all `null`).
  - For the suspend assertion, mirror patterns from existing tests around L3214 and L3720 in the same file.
- **No production code changes** in this sub-ticket (depends on sub-ticket 01).

## Verification: code
