# 05 — Telepipe dialogue Set rehydration

Fix checkpoint restore so `_dialogueRoomsEntered` is rehydrated from its serialized array form back into a `Set`, matching how `dialogueFired` is already handled. Without this, telepipe suspend/resume in scripted quests with `onRoomEntered` dialogue beacons throws `TypeError: entered.has is not a function` every game-loop tick.

## Acceptance Criteria

- `initDialogueState(run)` converts a restored `_dialogueRoomsEntered` array into a `Set` (same pattern as `ensureDialogueFired` for `dialogueFired`).
- After telepipe extract and resume on a scripted quest with `onRoomEntered` beacons (e.g. `training_caverns` tier 1), `tickDialogueRoomEntry()` runs without throwing and `run._dialogueRoomsEntered` is a `Set` with `.has()` / `.add()` working.
- Room-entry dialogue keys entered before suspend are still present in the restored Set (no duplicate beacon spam on re-entry).
- `cd game && pnpm test:quick` passes, including a new regression test in `game/server/test/passage_locks.test.js` (or `quest_dialogue.test.js`) that: deploys a gated scripted quest, enters a room to populate `_dialogueRoomsEntered`, telepipe-extracts, restores checkpoint, calls `tickDialogueRoomEntry`, and asserts no exception plus `Set` type.

## Technical Specs

- **Edit:** `game/server/questDialogue.js` — in `initDialogueState`, add an `else if (Array.isArray(run._dialogueRoomsEntered))` branch that assigns `new Set(run._dialogueRoomsEntered)` (mirror lines 11–13 in `ensureDialogueFired`). Optionally extract a small `ensureDialogueRoomsEntered(run)` helper for symmetry.
- **Edit:** `game/server/progression.js` — no serialization change required (`captureCardCheckpoint` already spreads the Set to an array); confirm `restoreCardCheckpoint()` still calls `initDialogueState(_gameState.run)` after deep-clone.
- **Edit:** `game/server/test/passage_locks.test.js` — add `telepipe resume rehydrates _dialogueRoomsEntered as Set for room-entry dialogue` test using `deployPassageLockFixture()` or `training_caverns` deploy helpers, `tryEnterTelepipe`, `restoreCardCheckpoint`, `tickDialogueRoomEntry`, and assertions on `instanceof Set` plus stable tick behavior.

## Verification: code
