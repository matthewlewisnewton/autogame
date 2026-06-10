# Client: quest board panel flashes open then is re-hidden by the lobby render loop (F at Quest Board unusable)

## Difficulty: easy

## Goal

Found while playtesting (2026-06-09). Pressing F at the Quest Board booth never leaves the quest list visible, so quests cannot be browsed/selected through the UI at all.

WHAT HAPPENS
openQuestPanel() (game/client/main.js ~2180-2188 at commit b4a5bb8) calls showGameLobby() and then removes 'hidden' from #quest-board-wrapper. But showGameLobby() unconditionally re-adds 'hidden' to the wrapper (~line 484, comment: "keep it hidden each time the lobby is (re)shown"), and the lobby-phase state-update path calls showGameLobby() / the lobbyMenuDismissed branch (~lines 589-597) on every STATE_UPDATE (~20/sec), which immediately re-adds 'hidden'. Net effect: the panel is visible for at most one frame.

REPRO
1. Register, enter hub lobby, walk to the Quest Board booth.
2. Press F.
3. Observe: the lobby menu opens but #quest-board-wrapper still has class 'hidden'. No quest list is shown.

FIXED WHEN
Pressing F at the Quest Board shows the quest list and it STAYS visible across state updates until explicitly dismissed; selecting a quest from it works end-to-end (with the SELECT_QUEST server bead autogame-7uv1 fixed).

NOTE: refs at commit b4a5bb8; lines may have drifted. Search main.js for 'quest-board-wrapper'.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
