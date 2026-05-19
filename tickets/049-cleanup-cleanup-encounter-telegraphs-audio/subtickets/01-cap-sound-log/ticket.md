# Gate `_playSoundCallLog` behind test-only flag

`_playSoundCallLog` in `game/client/main.js` unconditionally pushes on every `playSound()` call, causing an unbounded memory leak during normal gameplay. The array is test-only but the production path writes to it.

## Acceptance Criteria
- `_playSoundCallLog.push(type)` is gated behind a test-only flag so it does **not** execute during normal gameplay.
- The `__playSoundCallLog()` and `__clearPlaySoundLog()` window test hooks still work correctly.
- Existing `cardUsed handler — enemyHit sound throttle` unit tests continue to pass (multi-hit throttle, single-hit, empty hits).

## Technical Specs
- **`game/client/main.js`** — Introduce a boolean flag (e.g. `_soundLogEnabled = false`) that guards the `_playSoundCallLog.push(type)` call inside `playSound()`. Keep the existing `window.__playSoundCallLog` and `window.__clearPlaySoundLog` test hooks on the `window` object unchanged. The test hooks should enable the flag (or the test environment already sets it via vitest setup) so tests still capture the log.

## Verification: code
