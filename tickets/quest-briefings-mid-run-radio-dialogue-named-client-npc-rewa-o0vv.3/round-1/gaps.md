1. Run-start quest dialogue is emitted before clients enter `playing`, so normal deploys drop the radio line instead of rendering it.
   Files: `game/server/progression.js`, `game/client/main.js`
   Fix: deliver `run_start` after `START_GAME`/playing `STATE_UPDATE`, or queue/accept quest dialogue on the client during the deploy transition so all squad members see it.

2. Unlocked tier-2 quest-board selections still show fallback `Contract issuer unknown` and no briefing.
   Files: `game/server/quests.js`, `game/client/questBoard.js`
   Fix: add real `client` briefing data and dialogue metadata to every selectable tier-2 quest, or inherit explicit tier-appropriate briefing content before rendering the board.

3. The authored `endless_siege` `{ waveCleared: 5 }` radio beat never fires because no server hook emits `waveCleared` dialogue.
   Files: `game/server/objectives.js`, `game/server/progression.js`, `game/server/questDialogue.js`, `game/server/quests.js`
   Fix: fire `fireQuestDialogue(io, gameState, { waveCleared: defeatedOrWaveCount })` from the survive/wave progression path when the configured wave threshold is reached.
