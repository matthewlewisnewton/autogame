# Grant Run Rewards Logic

Implement `grantRunRewards()` and `grantCard()` helpers on the server. Victory grants a currency bonus plus at least one card reward; failure preserves picked-up currency but skips the victory card reward. Unknown card ids are rejected.

## Acceptance Criteria
- `grantCard(player, cardId)` increments `player.ownedCards[cardId]` by 1 (creating the key at count 1 if missing).
- `grantCard()` rejects or silently ignores unknown card ids (not present in `CARD_DEFS`).
- `grantRunRewards(playerId, summary)` does the following:
  - On victory (`summary.status === 'victory'`): adds a small currency bonus (e.g., +10) to `player.currency`, grants at least one card reward, and sets `player.runRewards` to a summary of what was earned.
  - On failure (`summary.status === 'failed'`): does NOT grant a victory card reward, does NOT add currency bonus, but does NOT remove or reset any currency the player already picked up during the run.
- Card rewards are drawn from known `CARD_DEFS` ids (e.g., first victory grants `flame_blade`, subsequent victories rotate through known card ids).
- `buildPlayerRewardSummary(playerId)` returns `{ currency: N, cards: [{ id, name, count }] }` for inclusion in the run-complete payload.
- Unit tests cover: `grantCard()` increments counts, unknown card id is rejected, victory grants rewards, failure skips victory cards.

## Technical Specs
- **File**: `game/server/index.js`
  - Add `grantCard(player, cardId)` — validates `cardId` against `CARD_DEFS`, increments `player.ownedCards[cardId]` (defaulting to 0 first). Returns boolean indicating success.
  - Add `grantRunRewards(playerId, summary)` — looks up player by `playerId`, checks `summary.status`. On victory: `player.currency += 10`, picks a card reward (simple rotation or deterministic: first victory `flame_blade`, then cycle through `battle_familiar`, `dungeon_drake`), calls `grantCard()`, records to `player.runRewards`. On failure: no-op for cards/currency bonus.
  - Add `buildPlayerRewardSummary(playerId)` — reads `player.currency` and `player.ownedCards`, maps card ids to names via `CARD_DEFS`, returns structured object.
  - Export `grantCard`, `grantRunRewards`, `buildPlayerRewardSummary` in module.exports.
- **File**: `game/server/test/server.test.js`
  - Unit test: `grantCard()` increments owned card count, starting from 0.
  - Unit test: `grantCard()` rejects unknown card id (count stays 0 or key absent).
  - Unit test: `grantRunRewards()` on victory adds currency bonus and at least one card.
  - Unit test: `grantRunRewards()` on failure does not add victory card or currency bonus.
  - Unit test: `buildPlayerRewardSummary()` returns correct structure.

## Verification: code
