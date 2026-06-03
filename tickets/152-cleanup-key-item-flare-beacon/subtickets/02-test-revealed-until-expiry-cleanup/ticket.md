# Add server test for expired revealedUntil tick cleanup

`simulation.js` deletes `enemy.revealedUntil` when the timestamp expires (inside `updateMinions`), but no server test advances time or runs the tick path to assert the field is cleared. Client tests cover local VFX expiry only.

## Acceptance Criteria

- A server test in the flare_beacon test area sets `enemy.revealedUntil` to a timestamp in the past, invokes the simulation tick path that performs cleanup, and expects `revealedUntil` to be `undefined` afterward.
- The same test (or a sibling case) confirms an enemy whose `revealedUntil` is still in the future keeps the field after one tick.
- Test passes under `pnpm test:quick` without starting a redundant duplicate server file (prefer `setGameState` + `updateMinions` over a second full socket suite if possible).

## Technical Specs

- **File**: `game/server/test/key-items.test.js` — add one or two `it(...)` cases inside the existing `describe('useKeyItem — flare_beacon')` block (after the useKeyItem integration tests).
- **Read-only reference**: `game/server/simulation.js` — expired `revealedUntil` cleanup lives at the end of `updateMinions()` (~lines 2132–2137).
- **Imports**: use `setGameState` and `updateMinions` from `../simulation.js` (same pattern as echo_strike tests in this file that call `setSimGameState` + `processPendingEchoes`). Point `setGameState` at the lobby `state` from `testGameState()` or a minimal `{ enemies: [...] }` stub with empty `minions` / `players` as needed.
- **Test setup**: push an enemy with `revealedUntil: Date.now() - 1000`, call `updateMinions()`, assert `enemy.revealedUntil === undefined`. For the control case, use `Date.now() + 5000` and assert the field remains defined.
- **No production changes** unless extracting the cleanup into a named helper materially simplifies the test (unlikely — prefer calling `updateMinions` directly).

## Verification: code
