## Per-Criterion Findings

### Runtime health
PASS. The captured run loaded successfully: `metrics.json` has `"ok": true`, `pageerrors` is empty, and `console.log` contains only normal Vite/init logs. `server.log` and `client.log` show a clean game session with only benign Three/Vite shutdown noise. Coverage/test visibility is also clean: `139` test files and `1956` tests passed.

### Selecting a quest shows client name, briefing, and reward before ready-up
FAIL. The tier-1 quest rows have client/briefing/reward content and `renderQuestBoard()` renders a briefing panel for the current selection. However, the live quest board also exposes unlockable tier-2 rows via `listQuestVariants()`, and the tier-2 quest definitions do not carry `client`, `briefing`, or `dialogue` data. When a tier-2 contract is unlocked and selected, the panel falls back to `Contract issuer unknown` with an empty briefing, so the criterion is not robustly met for every selectable quest-board contract.

### `crystal_rescue` prism and completion radio lines
PASS for the explicit prism/completion path. `crystal_rescue` tier 1 has distinct `{ itemCollected: 1 }`, `{ itemCollected: 2 }`, `{ itemCollected: 3 }`, and `objective_complete` lines. `recordCrystalCollected()` fires item-count dialogue from server objective progress, and `checkRunTerminalState()` fires the extraction line when the objective completes. The server tests cover the sequential prism and objective-complete events.

### Dialogue events are server-triggered and visible to squad members
FAIL. Item-collected and objective-complete dialogue are server-triggered, but `run_start` dialogue is emitted too early during deployment. `startDungeonRun()` fires `QUEST_DIALOGUE` before `START_GAME` and before the first playing `STATE_UPDATE`; the client handler intentionally ignores quest dialogue unless `gameState.gamePhase === 'playing'`. A normal deploying client therefore drops the run-start radio line before it can be logged or toasted. The capture probe body text after deploy also contains no Rewa radio line, which matches the ordering issue.

`waveCleared` is also modeled and authored for `endless_siege`, but there is no gameplay hook that ever calls `fireQuestDialogue(..., { waveCleared: ... })`. That authored mid-run progress beat is dead code, so not all scripted progress triggers currently reach players.

### Design and foundation consistency
The implementation fits the PSO-style quest-briefing direction and does not regress the foundation requirements: the captured game renders, connects over sockets, shows multiplayer state, and syncs movement. The main design gaps are the incomplete per-tier briefing coverage and the trigger delivery bugs above.

### Debug scenarios
The added `quest-comms-run-start` scenario is gated through the existing debug scenario path, and the equivalent state is reachable by selecting Initiate Vault and deploying normally. `collect-prisms-progress` remains a QA shortcut for a normally reachable partial crystal objective and does not replace the normal collection flow. The debug shortcuts do not appear to weaken server-side validation or normal gameplay invariants.

## Remaining gaps

1. Run-start quest dialogue is emitted before clients enter `playing`, so normal deploys drop the radio line instead of rendering it.
   Files: `game/server/progression.js`, `game/client/main.js`
   Fix: deliver `run_start` after `START_GAME`/playing `STATE_UPDATE`, or queue/accept quest dialogue on the client during the deploy transition so all squad members see it.

2. Unlocked tier-2 quest-board selections still show fallback `Contract issuer unknown` and no briefing.
   Files: `game/server/quests.js`, `game/client/questBoard.js`
   Fix: add real `client` briefing data and dialogue metadata to every selectable tier-2 quest, or inherit explicit tier-appropriate briefing content before rendering the board.

3. The authored `endless_siege` `{ waveCleared: 5 }` radio beat never fires because no server hook emits `waveCleared` dialogue.
   Files: `game/server/objectives.js`, `game/server/progression.js`, `game/server/questDialogue.js`, `game/server/quests.js`
   Fix: fire `fireQuestDialogue(io, gameState, { waveCleared: defeatedOrWaveCount })` from the survive/wave progression path when the configured wave threshold is reached.

VERDICT: FAIL
