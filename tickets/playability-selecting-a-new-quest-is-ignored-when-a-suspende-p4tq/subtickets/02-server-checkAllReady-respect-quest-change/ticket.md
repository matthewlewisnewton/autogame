# checkAllReady should start fresh run when selected quest differs from suspended checkpoint

## Description

`checkAllReadyInner()` in `progression.js` (~line 3949) unconditionally restores the suspended checkpoint when one exists:

```js
if (_gameState.suspendedCheckpoint) {
  restoreCardCheckpoint();
  return;
}
```

This means even if the player selected a different quest (after sub-ticket 01 clears the checkpoint on selection), or if the checkpoint was cleared by the "Abort Sortie" button, the ready-up path is wrong. Fix the guard: only resume the suspended checkpoint if the selected quest+tier **matches** the checkpoint's quest+tier. Otherwise, fall through to the fresh-deploy path.

## Acceptance Criteria

- When `suspendedCheckpoint` exists AND `selectedQuestId`/`selectedQuestTier` match the checkpoint's `run.questId`/`run.questTier`: ready-up restores the checkpoint (unchanged behavior)
- When `suspendedCheckpoint` exists BUT selected quest+tier **differs**: ready-up starts a FRESH run for the newly selected quest (generates new layout, enemies, spawn seed) — the checkpoint should have already been cleared by sub-ticket 01, but this guard is a safety net
- When `suspendedCheckpoint` is `null`: ready-up starts fresh run (unchanged)
- Existing tests for `checkAllReady` resume path continue to pass
- Add test: suspended checkpoint + different selected quest → fresh deploy with new quest's layout/objective

## Technical Specs

- **File:** `game/server/progression.js` — modify `checkAllReadyInner()` (~line 3949). Replace:
  ```js
  if (_gameState.suspendedCheckpoint) {
    restoreCardCheckpoint();
    return;
  }
  ```
  With a check that compares `selectedQuestId`/`selectedQuestTier` against `suspendedCheckpoint.run.questId`/`suspendedCheckpoint.run.questTier`. Only call `restoreCardCheckpoint()` when they match. When they differ (or checkpoint is null), fall through to the existing fresh-deploy code below.
- **File:** `game/server/test/server.test.js` — add test case verifying the mismatch path. Set up a suspended checkpoint for quest A, set `selectedQuestId` to quest B, call `checkAllReady()`, assert `gamePhase === PLAYING`, `run.questId === questB`, and `suspendedCheckpoint === null`.

## Verification: code
