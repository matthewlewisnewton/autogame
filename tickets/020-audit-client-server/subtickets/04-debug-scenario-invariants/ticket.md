# Debug Scenarios Must Preserve Server Invariants

`applyDebugScenario()` bypasses normal server setup: it directly sets `player.ready = true`, calls `enterPlayingPhase()` (skipping `checkAllReady` deck validation), and mutates HP/mana/enemy state without going through the validated `playerReady` → `checkAllReady` → `createDrawDeckFromSelectedDeck` → `initPlayerHand` flow. This creates states that real players cannot reach and risks masking bugs in the normal path. Route debug scenarios through the same validated paths or a dev helper that preserves invariants.

## Acceptance Criteria
- `applyDebugScenario` must validate the player's deck via `validateDeck(player.selectedDeck, player.ownedCards)` before entering the playing phase — same validation the normal `playerReady` path uses.
- `applyDebugScenario` must initialize `player.deck` and `player.hand` through `createDrawDeckFromSelectedDeck()` and `initPlayerHand()` (which `enterPlayingPhase` already calls), not by skipping them.
- `applyDebugScenario` must set `player.firstMoveAfterSpawn = false` and reset position to spawn, matching what `checkAllReady` does — preventing the first-move speed-check bypass.
- The `enterPlayingPhase()` helper must not re-initialize decks/hands if they are already initialized (idempotent guard), so calling it from both `checkAllReady` and `applyDebugScenario` is safe.
- Debug scenario–specific mutations (HP, mana, enemy placement) are applied **after** the validated setup, not before.

## Technical Specs
- **File**: `game/server/index.js` — In `applyDebugScenario()`, before calling `enterPlayingPhase()`, add deck validation: `const result = validateDeck(player.selectedDeck, player.ownedCards); if (!result.valid) return { ok: false, reason: result.reason };`. Remove `player.firstMoveAfterSpawn = true` (replace with `player.firstMoveAfterSpawn = false`, matching `checkAllReady`). In `enterPlayingPhase()`, wrap the deck/hand initialization in an idempotent guard so it's safe to call from both `checkAllReady` and `applyDebugScenario`: change the loop to `for (const player of Object.values(gameState.players)) { if (!player.hand || player.hand.length === 0) { createDrawDeckFromSelectedDeck(player); initPlayerHand(player); } }`.
- **No other files changed.** Do not modify client files, config, or tests.

## Verification: code
