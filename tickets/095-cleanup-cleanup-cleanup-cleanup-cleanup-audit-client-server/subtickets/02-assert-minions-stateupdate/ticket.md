# Assert minions on stateUpdate payload in new test

The new monster integration test checks `gameState.minions` on the server after `useCard` but does not assert `updatedSnapshot.minions` from the awaited `stateUpdate` event. Adding this assertion catches client-server replication gaps earlier.

## Acceptance Criteria
- The monster integration test asserts that `updatedSnapshot.minions` (from the `stateUpdate` event) includes the new minion with correct `ownerId` and `hp`.
- The test still passes without client code involved.
- All server integration tests still pass.

## Technical Specs
- **Files to change:** `game/server/test/integration/combat.test.js` (the newer monster spawn test that uses the `monster-card` scenario)
- After the `useCard` emit and awaiting `stateUpdate`, add an assertion on `updatedSnapshot.minions` (or whatever variable holds the stateUpdate payload) checking:
  - `minions.length` increased by 1
  - The new minion has the expected `ownerId` (the player who used the card)
  - The new minion has correct `hp` matching the monster card definition
- Verify all tests pass.

## Verification: code
