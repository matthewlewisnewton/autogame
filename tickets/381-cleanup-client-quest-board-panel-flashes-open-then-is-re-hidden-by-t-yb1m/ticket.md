# Cleanup nits from client-quest-board-panel-flashes-open-then-is-re-hidden-by-t-yb1m

> **Staleness note.** This follow-up ticket was written against commit
> `df9cd7f7` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `client-quest-board-panel-flashes-open-then-is-re-hidden-by-t-yb1m`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Top-level harness capture should exercise quest board visibility

Round-1 used the fallback full-flow smoke (auth → lobby → deploy → dungeon movement) and never opened the Quest Board booth. A future capture plan for lobby UI tickets should include either `?booth=quest` on localhost or an F-key booth step so browser screenshots prove the panel stays visible across ticks.

### Acceptance Criteria
- Capture metrics include at least one probe with `questPanelOpen: true` (or equivalent DOM check that `#quest-board-wrapper` lacks `hidden` after multiple lobby-phase ticks).
- Screenshot shows the Contract Terminal quest list while in hub lobby.

## Lobby-phase STATE_UPDATE integration test for quest panel

`questBooth.test.js` calls `showGameLobby()` directly to simulate re-renders. A follow-up test could drive two consecutive lobby-phase state updates through the real `STATE_UPDATE` handler (or a thin test hook around `returnToGuildLobby`) to lock in the full tick path, not only the helper.

### Acceptance Criteria
- Test opens the quest panel via booth action, applies two lobby-phase state payloads, and asserts `#quest-board-wrapper` remains visible and `__isQuestPanelOpen()` stays true.
