# Consolidate overlapping monster card integration tests

The two Monster card tests in `integration.test.js` (`emits useCard, server spawns a minion…` and `uses monster card via useCard…`) share nearly identical `monster-card` scenario setup. Merge them into a single test that asserts everything: minion spawn in `gameState.minions`, `stateUpdate.minions` broadcast, and hand-slot replacement.

## Acceptance Criteria
- The two existing monster card tests are replaced by a single test (or a shared setup helper + one test) that covers:
  - Minion spawn in `gameState.minions` (ownerId, hp: 50, ttl ~30)
  - `stateUpdate` broadcast payload includes `minions` with the new minion
  - Hand slot replacement (new card in slot, or hand shrunk if deck exhausted)
- No duplication of `debugScenario` / `monster-card` setup code
- `pnpm run test` in `game/` passes with no regression in monster-related assertions

## Technical Specs
- **File:** `game/server/test/integration.test.js`
- Extract a shared `setupMonsterCard()` helper (or fold the two `it` blocks into one) that: emits `debugScenario`, captures `stateUpdate`, finds the monster slot, and returns `{ socket, playerKey, monsterSlot, monsterCardId }`
- The single merged test should assert `gameState.minions`, `updatedSnapshot.minions`, and hand replacement in one flow
- Remove the old two tests entirely

## Verification: code
