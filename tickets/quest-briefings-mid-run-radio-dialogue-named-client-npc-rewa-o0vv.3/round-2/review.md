# Final Review

## Runtime health
PASS. The captured run is valid: `metrics.json` reports `"ok": true`, the page error list is empty, and `console.log` contains no `pageerror` or `[fatal]` entries from game code. The server and client logs show normal startup/shutdown with only benign Vite socket-close noise. The fallback capture reached a two-player playing run with canvas rendering, lobby-to-run transition, movement, and HUD updates.

Coverage visibility is also healthy: the round-2 coverage log reports `139 passed` test files and `1965 passed` tests, including the new server quest-dialogue tests and client quest-board/comms tests.

## Acceptance criteria

### Selecting a quest on the board shows client name, briefing, reward before ready-up
PASS. The quest payload now carries `client`, `dialogue`, reward currency, and optional signature-card metadata through `buildSharedQuestUpdatePayload()` / `buildQuestUpdatePayload()`. The client quest board renders a selected-quest briefing panel with Client, Briefing, and Reward fields, and the server `selectQuest` handler emits updated quest payloads while still enforcing lobby phase, suspended-run lockout, valid quest/tier, and tier unlock rules.

### During `crystal_rescue`, collecting each prism fires a distinct radio line; completing the objective fires an extraction line
PASS. `crystal_rescue` tier 1 defines distinct Lysa lines for prism collections 1, 2, and 3, plus an `objective_complete` extraction line. The live pickup flow removes crystal loot, calls `recordCrystalCollected(1)`, and then calls `checkRunTerminalState()` for completion, so collection and extraction dialogue are driven by the same server objective path that completes the run.

### Dialogue events are driven by server triggers so all squad members see them
PASS. `questDialogue.fireQuestDialogue()` dedupes fired triggers per run and emits `questDialogue` from the server. Run-start dialogue fires after `START_GAME` and the playing `stateUpdate`; prism collection, survive wave progress, and objective completion fire from progression hooks. In normal lobby context, `getIoTarget()` scopes the emit target to `io.to(lobbyId)`, so every socket in the squad room receives the same server event without relying on client timers.

### Quest content and design consistency
PASS. All existing tier-1 quests have named clients, pre-run briefing copy, reward copy, run-start dialogue, and completion dialogue; collect-item quests additionally define per-item beats. This fits the PSO-style guild-counter briefing and in-run radio direction in `game/docs/design.md`, and it does not regress the foundation requirements: the captured run still connects client/server, renders the 3D scene, displays multiplayer state, and synchronizes movement.

### Debug scenarios
PASS. This ticket adds/changes debug scenario support for quest-comms and wave-progress QA. The URL parameter remains the only client entry point, gated to localhost in the client and local/dev sockets on the server. The new scenario comments trace equivalent normal gameplay paths, and the shortcuts still use server-side quest/run state, layout application, progression hooks, and lobby-scoped state updates rather than client-only state.

## Remaining gaps

None.

VERDICT: PASS
