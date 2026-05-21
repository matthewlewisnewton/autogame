# Consolidate duplicate monster integration setup

The older test `emits useCard, server spawns a minion in gameState.minions` manually injects `dungeon_drake` into `player.hand` after `summon-ready`, while the newer test correctly uses a `monster-card` scenario. Refactor the older test to use the same scenario-based setup to reduce maintenance noise.

## Acceptance Criteria
- The older monster spawn test uses the `monster-card` scenario (or a shared helper) instead of directly mutating `player.hand`.
- No direct `player.hand` mutation remains in that test for summon setup.
- All server integration tests still pass (`pnpm run test` in `game/`).

## Technical Specs
- **Files to change:** `game/server/test/integration/combat.test.js` (or whichever integration test file contains the `emits useCard, server spawns a minion` test)
- Find the older monster test that does `player.hand = [...]` or similar manual injection after `summon-ready`.
- Replace with the `monster-card` scenario pattern used by the newer test (likely via `scenario()` helper or `createScenario('monster-card')`).
- Verify all tests pass.

## Verification: code
