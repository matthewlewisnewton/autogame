# 211-net-slim-per-tick-state-broadcast

## Difficulty: medium

## Goal

stateSnapshot() (game/server/progression.js:3210-3271) is emitted every tick (20Hz, index.js:977-1014) and includes static/rarely-changing per-player data: deck, desperationDeck, hand, ownedCards, inventory (deep-cloned per player L3231), selectedDeck, runRewards, plus per-tick previewReturnRewards() and buildSuspendedRunSummary(). Dominant bandwidth+GC cost, grows with deck/inventory size.

## Acceptance Criteria

- 1. Split into a hot per-tick stateUpdate (positions/hp/rotation/combat flags/enemies/minions/loot) and cold per-player data pushed only on change via existing deckUpdate/cardInventoryUpdate events. 2. First, no-behavior-change wins: hoist lobby-level computes (suspendedRunSummary, shopOffer) out of the per-player loop; stop deep-cloning inventory in the hot path. 3. Match removals in client stateUpdate handler (game/client/main.js:928); no UI desync of deck/inventory.

## Verification

SIMPLICITY/efficiency, not a correctness bug. Start with the loop-hoist + drop-clone before changing wire shape. Risk: client authoritative-state apply path — playtest.

composer_write failed (rc=2)
