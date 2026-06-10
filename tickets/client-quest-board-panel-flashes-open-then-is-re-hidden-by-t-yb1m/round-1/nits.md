## Top-level harness capture should exercise quest board visibility

Round-1 used the fallback full-flow smoke (auth → lobby → deploy → dungeon movement) and never opened the Quest Board booth. A future capture plan for lobby UI tickets should include either `?booth=quest` on localhost or an F-key booth step so browser screenshots prove the panel stays visible across ticks.

### Acceptance Criteria
- Capture metrics include at least one probe with `questPanelOpen: true` (or equivalent DOM check that `#quest-board-wrapper` lacks `hidden` after multiple lobby-phase ticks).
- Screenshot shows the Contract Terminal quest list while in hub lobby.

## Lobby-phase STATE_UPDATE integration test for quest panel

`questBooth.test.js` calls `showGameLobby()` directly to simulate re-renders. A follow-up test could drive two consecutive lobby-phase state updates through the real `STATE_UPDATE` handler (or a thin test hook around `returnToGuildLobby`) to lock in the full tick path, not only the helper.

### Acceptance Criteria
- Test opens the quest panel via booth action, applies two lobby-phase state payloads, and asserts `#quest-board-wrapper` remains visible and `__isQuestPanelOpen()` stays true.
