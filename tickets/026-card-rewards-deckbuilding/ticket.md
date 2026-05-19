# Session Inventory and Card Rewards

Add server-owned session inventory and post-run card rewards. This ticket should not build the lobby deck editor; that is handled by `028-lobby-deck-editor`.

## Dependencies

This ticket assumes `027-run-summary-return-to-lobby` has a run summary event and return-to-lobby flow.

## Goal

Players should earn something meaningful from a completed run, even before persistence and accounts exist. Rewards can remain in memory for the current browser/server session.

## Acceptance Criteria
- Each player has server-owned session reward state.
- The reward state includes:
  - `currency`
  - `ownedCards`, represented as card id counts or an equivalent server-validatable structure
  - `runRewards`, a short history or latest reward summary
- New players start with:
  - enough owned cards to build the current starting deck
  - the current starting deck's card ids available in their inventory
  - `currency: 0`
- Currency picked up during a run is tracked per player and included in the run summary.
- Completing a run grants each participating player:
  - a small currency bonus
  - at least one card reward
- Failure does not grant the victory card reward, but it keeps currency already picked up during the run.
- Card rewards are selected from known card definitions.
- The server never grants an unknown card id.
- The `runComplete` payload includes per-player rewards.
- The client summary overlay displays earned currency and card names from the server payload.
- Reward state survives returning to lobby and starting another run in the same server session.
- Reward state does not need to survive a server restart.

## Implementation Notes
- Keep card reward logic deterministic enough for tests. A simple first-pass reward table is fine:
  - first victory grants `flame_blade`
  - later victories rotate through known card ids
  - or use seeded/random choice with test hooks
- Prefer helpers in `game/server/index.js`:
  - `createPlayerProgress()`
  - `grantRunRewards(playerId, summary)`
  - `grantCard(player, cardId, count = 1)`
  - `buildPlayerRewardSummary(playerId)`
- If client and server cannot easily share `CARD_DEFS` yet, duplicate only the minimal server-side card id/name table needed for validation and rewards. A later cleanup can share definitions.
- Do not add auth, database persistence, trading, shops, card rarity, or deck editing in this ticket.

## Files
- `game/server/index.js`
- `game/client/main.js`
- `game/client/cards.js`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`

## Tests
- Unit test that a new player gets starting owned cards and zero currency.
- Unit test that `grantCard()` increments owned card counts.
- Unit test that unknown card ids are rejected or ignored.
- Integration test that currency picked up during a run appears in the run summary.
- Integration test that victory grants card rewards.
- Integration test that failure preserves picked-up currency but does not grant victory cards.
- Integration test that returning to lobby preserves session reward state.

## Verification: visual
