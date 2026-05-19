# Rewards In Run Complete Payload

Wire `grantRunRewards()` into the run terminal-state flow so that the `runComplete` / `runFailed` payload includes per-player rewards. The server calls `grantRunRewards()` before emitting the summary, and each player entry in the summary contains a `rewards` sub-object.

## Acceptance Criteria
- When a run ends in victory, `checkRunTerminalState()` calls `grantRunRewards()` for each participating player before emitting `runComplete`.
- When a run ends in failure, `checkRunTerminalState()` calls `grantRunRewards()` for each player (which skips victory rewards) before emitting `runFailed`.
- The `runComplete` / `runFailed` payload includes a `rewards` field per player: `{ currency: N, cards: [{ id, name, count }] }`.
- Integration test: after a victory run, the `runComplete` payload contains per-player rewards with at least one card.
- Integration test: after a failure run, the `runFailed` payload contains per-player rewards but no victory card.
- Integration test: currency picked up during a run (via `lootPickup`) appears in the player's currency in the run summary.

## Technical Specs
- **File**: `game/server/index.js`
  - In `checkRunTerminalState()`, before building the run summary, iterate over all players and call `grantRunRewards(playerId, null)` (the summary isn't built yet, so pass status directly or restructure slightly). Alternatively: determine status first, call `grantRunRewards(playerId, { status })` for each player, then build the summary.
  - In `buildRunSummary()`, add a `rewards` field to each player entry by calling `buildPlayerRewardSummary(playerId)`.
  - The flow should be: determine status → set `run.status` → call `grantRunRewards()` per player → build summary → emit.
- **File**: `game/server/test/integration.test.js`
  - Integration test: connect a client, complete a run (all enemies defeated), assert `runComplete` payload has `players[i].rewards` with cards and currency bonus.
  - Integration test: connect a client, fail a run (all players dead), assert `runFailed` payload has `players[i].rewards` but no victory card reward.
  - Integration test: pick up loot during a run, verify the player's currency in the summary reflects the picked-up amount.

## Verification: code
