# Fix Failing buildPlayerRewardSummary Tests

The `buildPlayerRewardSummary` helper was updated to return run-only rewards (`player.runRewards`) instead of the full inventory balance. Three unit tests still assert the old inventory/balance semantics and cause the test suite to be red (3 failed, 135 passed). Rewrite these tests to match the current run-only contract.

## Acceptance Criteria
- All 3 `buildPlayerRewardSummary` unit tests pass.
- The test 'returns correct structure' sets `player.runRewards` and asserts against its contents (not `player.currency` / `player.ownedCards`).
- The test 'maps card ids to names via CARD_DEFS' sets `player.runRewards` with card entries and verifies the card id/name mapping from the run-reward data.
- The test 'includes all owned cards' is rewritten to verify that all cards in `player.runRewards.cards` are present in the summary.
- The existing 'returns empty cards array for unknown player' test remains unchanged and still passes.
- `npm test` reports 0 failures after this change.

## Technical Specs
- **File**: `game/server/test/server.test.js`
  - In the `describe('buildPlayerRewardSummary(playerId)')` block:
    - Rewrite 'returns correct structure': set `addPlayer('p1', { runRewards: { currency: 10, cards: [{ id: 'flame_blade', name: 'Flame Blade', count: 1 }] } })`, assert `summary.currency === 10` and `summary.cards` is an array.
    - Rewrite 'maps card ids to names via CARD_DEFS': set `addPlayer('p1', { runRewards: { currency: 0, cards: [{ id: 'iron_sword', name: 'Iron Sword', count: 1 }] } })`, find the card entry by id and assert `.name === 'Iron Sword'`.
    - Rewrite 'includes all owned cards': set `addPlayer('p1', { runRewards: { currency: 0, cards: [{ id: 'iron_sword', name: 'Iron Sword', count: 2 }, { id: 'flame_blade', name: 'Flame Blade', count: 1 }, { id: 'battle_familiar', name: 'Battle Familiar', count: 1 }] } })`, assert `summary.cards.length === 3`.
  - Do NOT modify `game/server/index.js` — the implementation is correct.

## Verification: code
