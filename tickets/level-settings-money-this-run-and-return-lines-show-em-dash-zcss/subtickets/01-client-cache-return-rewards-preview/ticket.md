# Client: cache returnRewardsPreview across hot state ticks

## Description

The Lv overlay reads `returnRewardsPreview` via `syncLevelSettingsRewards()` in `game/client/main.js`. Per-tick `stateUpdate` payloads use `hotStateSnapshot()`, which omits cold fields including `returnRewardsPreview`. The client keeps a `_lastReturnRewardsPreview` fallback for slim ticks, but `stateHandlers.js` never seeds that cache when entering a run (`enteringPlaying`), so the preview is lost after the first hot tick and the overlay falls back to em-dash placeholders.

Fix the client state handler so the deploy/full snapshot seeds `_lastReturnRewardsPreview` and re-applies it on every subsequent slim tick while `gamePhase === 'playing'`.

## Acceptance Criteria

- After deploy, a hot `stateUpdate` that omits `returnRewardsPreview` does not clear the cached preview on the local player
- With a seeded preview (`lootCurrency: 0`), `syncLevelSettingsRewards()` renders `Money this run: none collected yet` and a non-`—` return-currency line instead of em-dash placeholders
- Entering the lobby (`gamePhase` transition to `lobby`) still clears `_lastReturnRewardsPreview`
- A focused client unit test covers preview survival across a slim tick

## Technical Specs

- **File**: `game/client/socketHandlers/stateHandlers.js`
  - In the `enteringPlaying` branch (~lines 78–81), when `me?.returnRewardsPreview != null`, assign `ctx._lastReturnRewardsPreview = me.returnRewardsPreview` (mirror the existing playing-phase cache logic at ~86–90)
  - Ensure the existing `else if (me && state.gamePhase === 'playing')` block continues to restore `ctx.gameState.players[ctx.myId].returnRewardsPreview` from `_lastReturnRewardsPreview` when the slim tick omits it
- **File**: `game/client/test/level-settings-rewards.test.js` (new)
  - Import/exercise `syncLevelSettingsRewards` (export it from `main.js` for test, or test via the same helper pattern used by other client tests)
  - Simulate: full playing snapshot with `returnRewardsPreview: { lootCurrency: 0, objectiveComplete: false, questBonus: 10, granted: false, currency: 0, cards: [], cardChoices: [] }`, then a slim tick without `returnRewardsPreview`, then call `syncLevelSettingsRewards()` and assert `#level-loot-earned` is not `Money this run: —` and `#level-return-currency` is not `—`
- **Optional export**: `game/client/main.js` — if needed for the test, export `syncLevelSettingsRewards` on `window` (already exports related overlay helpers) or as a named export

## Verification: code
