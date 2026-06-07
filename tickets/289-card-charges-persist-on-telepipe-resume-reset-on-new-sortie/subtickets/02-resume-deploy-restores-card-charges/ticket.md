# 02 — Resume deploy restores card charges from checkpoint

When all connected players ready up while `suspendedCheckpoint` is set, `checkAllReady()` must resume the suspended run (same `run.id`) and restore each player's hand/deck from the checkpoint instead of dealing a fresh draw deck. HP and magic stones on the player object must be preserved (not reset to max / starting values).

## Acceptance Criteria

- `checkAllReadyInner()` branches: if `_gameState.suspendedCheckpoint` exists, call a new `restoreCardCheckpoint()` and skip `createDrawDeckFromSelectedDeck()` / `initPlayerHand()` for every player.
- After resume deploy, `gameState.run.id` equals the checkpoint's saved run id (not a newly generated id).
- Restored hand cards retain their pre-suspend `remainingCharges` (e.g. a weapon spent down by 1 charge is still spent).
- Restored `deck` order and desperation state (`inDesperation`, `nextDrawAt`, `desperationDeck`) match the checkpoint.
- Player `hp` and `magicStones` are unchanged by resume deploy (regression guard for 287).
- `suspendedCheckpoint` is cleared and `suspendedRunSummary` is absent from snapshots after successful resume.
- Server logs `[run] checkpoint restored` on resume.
- Unit test `checkAllReady after telepipe extract spawns a fresh dungeon run` is updated to expect the **same** run id on redeploy.
- Unit test `fresh deploy after telepipe extract preserves hp and magicStones and resets card charges` is updated/renamed to assert **preserved** card charges (not reset) on telepipe-resume redeploy.

## Technical Specs

- **`game/server/progression.js`**:
  - Implement `restoreCardCheckpoint()`:
    - Reassign `_gameState.run` from checkpoint run metadata (preserve `id`).
    - For each player in checkpoint `playerStates`, restore `hand`, `deck`, `inDesperation`, `nextDrawAt`, `desperationDeck`, reset `extracted`/`ready`, keep existing `hp`/`magicStones`.
    - Set `gamePhase` to `playing`, call `assignRunSpawnPositions`, rebuild colliders if needed, emit `startGame` + `stateUpdate` (mirror existing deploy emit path).
    - Do **not** call `spawnEnemies()` when resuming if the checkpoint already captured world state; if 01 only captured card state, respawn world via existing `spawnEnemies()` but keep the saved `run.id` — prefer the minimal path that satisfies acceptance (same run id + card charges).
  - Wire the resume branch at the top of the deploy block inside `checkAllReadyInner()` (before `createDrawDeckFromSelectedDeck`).
  - Export `restoreCardCheckpoint` if tests need direct access.
- **`game/server/test/server.test.js`**: update telepipe redeploy tests listed above.

## Verification: code
