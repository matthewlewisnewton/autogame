# Allow quest selection when a suspended run exists — clear checkpoint on quest change

## Description

Currently `SELECT_QUEST` in `lobbyHandlers.js` rejects quest selection when `suspendedCheckpoint` exists (line ~146), emitting `quest_error: suspended_checkpoint`. This prevents the player from selecting a different quest after a suspend — they must manually "Abort Sortie" first.

Change the handler so that selecting the **same** quest as the suspended checkpoint is a no-op (still locked, as before). Selecting a **different** quest implicitly abandons the suspended checkpoint: clear `suspendedCheckpoint`, update `selectedQuestId`/`selectedQuestTier`, emit the quest preview layout, and broadcast the lobby update.

## Acceptance Criteria

- Sending `SELECT_QUEST` for the **same** quest+tier as the suspended checkpoint still rejects with `quest_error: suspended_checkpoint` (unchanged behavior)
- Sending `SELECT_QUEST` for a **different** quest+tier when `suspendedCheckpoint` exists:
  - Clears `state.suspendedCheckpoint` (sets to `null`)
  - Sets `state.selectedQuestId` and `state.selectedQuestTier` to the new values
  - Emits `quest_selected` payload with preview layout (same as normal path)
  - Broadcasts lobby update so all clients see the new selection
  - Subsequent `STATE_UPDATE` includes `suspendedRunSummary: null`
- Existing unit tests for `SELECT_QUEST` continue to pass
- Add unit tests covering: (a) same-quest rejection, (b) different-quest acceptance with checkpoint cleared

## Technical Specs

- **File:** `game/server/socketHandlers/lobbyHandlers.js` — modify `SELECT_QUEST` handler (~line 146). Before rejecting on `suspendedCheckpoint`, compare `questId/tier` against `state.suspendedCheckpoint.run.questId` and `state.suspendedCheckpoint.run.questTier`. If different, call `abandonSuspendedRun(state)` (already exported from `progression.js`), then proceed with normal quest selection.
- **File:** `game/server/test/server.test.js` or a new test file — add tests for the new branch. Use the existing test helpers (`connectAndJoinLobby`, `createTestGameState`) to set up a suspended checkpoint, then emit `SELECT_QUEST` with same vs different quest.

## Verification: code
