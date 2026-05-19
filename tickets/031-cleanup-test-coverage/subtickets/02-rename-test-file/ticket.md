# Rename misleading client test file

`game/client/test/main.test.js` tests `collision.js` and `hand.js` (plus a few `main.js` exports like `renderDeckEditor`, `flashMesh`, `spawnDamageNumber`, `spawnHitSpark`). The filename misleads anyone navigating the suite. Split into accurately named files.

## Acceptance Criteria

- Tests for `collision.js` and `hand.js` logic live in `game/client/test/collision-hand.test.js` (or two separate files).
- Tests for `main.js` exports (`renderDeckEditor`, `flashMesh`, `spawnDamageNumber`, `spawnHitSpark`, etc.) live in `game/client/test/main.test.js`.
- The old `main.test.js` containing everything is removed or replaced.
- `npm test` still discovers and passes all tests.

## Technical Specs

- **Files to create:** `game/client/test/collision-hand.test.js` (tests for `wallAABB`, `resolveWallCollision`, `drawCard`, `initHand`, `initHandFromDeck`, `canUseSlot`)
- **File to update:** `game/client/test/main.test.js` — keep only the `main.js`-related test suites (`renderDeckEditor`, `flashMesh`, `spawnDamageNumber`, `spawnHitSpark`, `spawnLootPickupFeedback`, etc.)
- **File to delete:** old monolithic `main.test.js` (replaced by the split)

## Verification: code
