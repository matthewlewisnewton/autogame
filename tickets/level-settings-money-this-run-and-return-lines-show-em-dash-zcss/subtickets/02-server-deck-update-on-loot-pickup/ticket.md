# Server: push returnRewardsPreview when currency loot is picked up

## Description

`currencyEarnedThisRun` increases when a player picks up money loot, but `game/server/socketHandlers/runHandlers.js` does not emit a `deckUpdate` afterward. The Lv overlay depends on `returnRewardsPreview` (attached to `deckUpdate` and cold snapshots) for live run-money totals. After sub-ticket 01 caches the preview, this sub-ticket ensures the preview's `lootCurrency` refreshes whenever run money is collected so reopening the overlay shows the updated amount.

## Acceptance Criteria

- Picking up currency loot during an active run emits a `deckUpdate` to the picking player whose `returnRewardsPreview.lootCurrency` matches their updated `currencyEarnedThisRun`
- Re-syncing the Lv overlay after loot pickup shows the collected amount (not `Money this run: —` or a stale zero)
- Magic-stone and crystal loot pickups do not regress (no erroneous currency preview)
- A server integration or unit test asserts `deckUpdate.returnRewardsPreview.lootCurrency` increases after a currency loot pickup

## Technical Specs

- **File**: `game/server/socketHandlers/runHandlers.js`
  - Import `maybeEmitPlayerDeckUpdate` from `../progression.js` (or the existing progression import surface used by this module)
  - In the `pickLoot` handler (~lines 207–220), after incrementing `player.currencyEarnedThisRun` for non-crystal, non-magic-stone loot, call `maybeEmitPlayerDeckUpdate(player)` so `buildPlayerDeckUpdatePayload()` attaches a fresh `returnRewardsPreview` from `previewReturnRewards()`
- **File**: `game/server/test/integration.test.js` (or a focused new test beside existing loot/preview coverage)
  - Start an in-run scenario (e.g. `summon-ready` or a debug scenario that spawns currency loot nearby)
  - Pick up currency loot via the `pickLoot` socket event
  - Assert the resulting `deckUpdate` includes `returnRewardsPreview.lootCurrency` equal to the player's `currencyEarnedThisRun` on the authoritative server state
- **Note**: `keyItemEffects.js` auto-collect paths already emit full `stateSnapshot()` (which includes cold preview fields); no change required there unless tests reveal a gap

## Verification: code
