1. Captured run fails after telepipe resume: `TypeError: entered.has is not a function` in `tickDialogueRoomEntry()` because `_dialogueRoomsEntered` restores as an array, not a Set.
   Files: game/server/questDialogue.js, game/server/progression.js, game/server/test/passage_locks.test.js
   Fix: Rehydrate `_dialogueRoomsEntered` from arrays to `Set` during dialogue init/restore and add a telepipe resume regression test for scripted quests with room-entry dialogue.

2. The two-gate passage-lock chain is only reachable through the `passage-lock-chain` debug fixture, not normal gameplay.
   Files: game/server/quests.js, game/server/debugScenarios.js, game/server/test/passage_lock_chain.test.js
   Fix: Put an equivalent chained room A -> room B -> treasure passage-lock flow into a registered selectable quest/tier, then update the debug scenario to shortcut that real flow.
