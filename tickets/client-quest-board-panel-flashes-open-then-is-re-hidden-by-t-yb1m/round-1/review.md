# Senior Review: Client quest board panel flashes open then is re-hidden

**Ticket:** `client-quest-board-panel-flashes-open-then-is-re-hidden-by-t-yb1m`  
**Baseline:** `2e95de082314d00646dd17f051934d15ccf7fabe`  
**Implementation commit:** `df9cd7f7` — `client-quest-board-panel-flashes-open-then-is-re-hidden-by-t-yb1m/01-guard-quest-panel-visibility`

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (also confirmed in `pageerrors.json`) |
| `console.log` page errors / `[fatal]` | None — only Vite connect, `[initScene]`, and benign HTTP 409 on auth |
| Servers started | Yes (`server.log`: listening on 3005; client on 5178) |

The captured run loads cleanly and reaches `playing` phase with two connected players. No harness infrastructure failure.

## Change summary

One sub-ticket added a `questPanelOpen` client flag in `game/client/main.js`:

- `openQuestPanel()` sets `questPanelOpen = true` after revealing `#quest-board-wrapper`.
- `showGameLobby()` skips re-adding `'hidden'` when `questPanelOpen` is true, preventing the lobby-phase `STATE_UPDATE` loop (~20/sec via `returnToGuildLobby` → `showGameLobby`) from flash-closing the panel.
- `dismissGameLobby()` resets `questPanelOpen = false` and re-hides the wrapper.
- `game/client/test/questBooth.test.js` updated with two targeted tests; all 18 quest-booth tests pass (`coverage.log`: 282/282 client tests in changed-files run).

## Per-criterion findings

### Pressing F at the Quest Board shows the quest list and it stays visible across state updates until dismissed

**Met.** Root cause was exactly as described in the ticket: `openQuestPanel()` called `showGameLobby()`, which unconditionally hid `#quest-board-wrapper`, and every lobby-phase `STATE_UPDATE` called `returnToGuildLobby()` → `showGameLobby()` again.

The fix is minimal and targets the correct choke point:

```490:492:game/client/main.js
	// Quest board only appears via the quest booth; skip hiding when it was
	// explicitly opened so STATE_UPDATE re-renders don't flash-close the panel.
	if (!questPanelOpen && questBoardWrapperEl) questBoardWrapperEl.classList.add('hidden');
```

`openQuestPanel()` also calls `showGameLobby()`, which clears `lobbyMenuDismissed`, so subsequent `STATE_UPDATE` ticks take the `showGameLobby()` branch in `returnToGuildLobby` rather than the dismissed-lobby hide path.

Unit tests verify:
- Booth open reveals the panel and sets `__isQuestPanelOpen()`.
- A subsequent `showGameLobby()` call leaves the panel visible (simulates the per-tick re-render).
- `dismissGameLobby()` resets the flag and re-hides the wrapper.

### Selecting a quest from the panel works end-to-end

**Met (client responsibility).** The ticket note references a separate server bead (`autogame-7uv1`) for `SELECT_QUEST`; this ticket's scope is the visibility blocker. With the panel now persistent, the existing selection surface in `renderQuestBoardState()` can receive clicks and emit `CLIENT_TO_SERVER.SELECT_QUEST`. The server handler in `game/server/socketHandlers/lobbyHandlers.js` is present and validates quest/tier before updating lobby state. No client regression was introduced.

Round-1 browser capture does not exercise quest-board interaction (fallback smoke deploys straight into a run), but the sub-ticket's unit coverage directly addresses the reported bug.

### Panel remains hidden by default; non-booth `showGameLobby()` still hides when not explicitly opened

**Met.** When `questPanelOpen` is false (default), `showGameLobby()` behavior is unchanged.

### Consistency with design / requirements

**No regressions.** Change is lobby UI visibility only; multiplayer, movement, and server-authoritative quest selection are untouched. Aligns with the design doc's lobby quest-selection flow.

### Code quality

**Good.** Small, focused diff (11 lines in `main.js`); flag lifecycle is symmetric (set on open, cleared on dismiss). Test export `__isQuestPanelOpen` is consistent with existing harness hooks. No dead code or console errors introduced.

### Debug scenarios (`?booth=quest`)

**No issues.** Pre-existing localhost-only `?booth=quest` hook calls `openQuestPanel()` once via `requestBoothDebugOpen()`. It is gated by `debugScenarioAllowed` (localhost hosts only), does not bypass server validation, and the normal path (walk to Quest Board booth, press F / `booth:action`) reaches the same UI state. No new debug scenario was added by this ticket.

## Test & coverage notes

- Changed-files vitest run: **14 files, 282 tests, all passed**.
- Coverage report in `coverage.log` covers shared modules from the harness diff baseline; the changed `main.js` paths are exercised by `questBooth.test.js`.

## Remaining gaps

None blocking. The implementation fully addresses the reported flash-close bug with appropriate tests and clean runtime capture.

VERDICT: PASS
