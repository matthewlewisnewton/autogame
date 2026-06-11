# Auto-fail runs stuck in combat exhaustion with a grace period

## Description

Wire `isPlayerCombatExhausted()` into run resolution so a stalled run ends instead of staying `playing` forever. Players who still hold uncastable cards (the Frost Crossing / Ember Descent soft-lock) should trigger a failed run after a short grace window; players with literally no cards left keep the existing immediate failure path.

## Acceptance Criteria

- `RUN_EXHAUSTION_GRACE_MS` constant added to `game/server/config.js` (recommended 15–30 seconds)
- `checkRunTerminalState()` in `game/server/progression.js` fails the run when every non-extracted in-dungeon player is combat-exhausted AND either (a) `isPlayerOutOfCards` is true for that player (immediate, preserves current behavior) or (b) `_combatExhaustedSince` is set and `Date.now() - _combatExhaustedSince >= RUN_EXHAUSTION_GRACE_MS`
- `tickCombatExhaustionGrace()` runs each playing-phase game tick: sets `_combatExhaustedSince` when a player becomes combat-exhausted, clears it when they regain a castable action or drawable cards, and calls `checkRunTerminalState()` once grace expires for all active in-dungeon players
- `tickCombatExhaustionGrace()` is invoked from `runGameLoopTick()` in `game/server/index.js` after `regenMagicStones()` and `processPassiveDraws()`
- If MS regen or a loot pickup makes a previously uncastable card affordable during the grace window, `_combatExhaustedSince` clears and the run stays `playing`
- Server test: player with `battle_familiar` (cost 50) at 25 MS, empty deck/desperation, remaining enemy — after advancing fake timers past `RUN_EXHAUSTION_GRACE_MS`, `run.status` becomes `failed` and `runFailed` is emitted
- Server test: same stall state but player still has `rusty_shiv` in desperation deck — run stays `playing`

## Technical Specs

- **File**: `game/server/config.js` — export `RUN_EXHAUSTION_GRACE_MS`
- **File**: `game/server/progression.js`
  - Import `RUN_EXHAUSTION_GRACE_MS`
  - Add `tickCombatExhaustionGrace(now)` using `isPlayerCombatExhausted` from sub-ticket 01
  - Update the deck-depletion branch inside `checkRunTerminalState()` (~line 3394) to use combat-exhaustion logic with the immediate vs grace distinction above
  - Export `tickCombatExhaustionGrace`
- **File**: `game/server/index.js` — call `tickCombatExhaustionGrace(Date.now())` inside the playing-phase branch of `runGameLoopTick()`
- **File**: `game/server/test/server.test.js`
  - Extend `describe('checkRunTerminalState()')` with MS-insufficient stall + fake-timer grace tests
  - Import `tickCombatExhaustionGrace` and `RUN_EXHAUSTION_GRACE_MS` as needed

## Verification: code
