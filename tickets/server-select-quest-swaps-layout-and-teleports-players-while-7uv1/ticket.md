# Server: SELECT_QUEST swaps layout and teleports players while lobby still renders the hub (movement freeze, booths dead)

## Difficulty: medium

## Goal

Found while playtesting (2026-06-09). Selecting any quest from the lobby instantly desyncs every player in the lobby and soft-freezes them until a run is force-started.

WHAT HAPPENS
On CLIENT_TO_SERVER.SELECT_QUEST the server immediately calls applyLayoutForQuest(state, questId, tier) and assignRunSpawnPositions(...) (game/server/socketHandlers/lobbyHandlers.js, SELECT_QUEST handler, ~lines 126-162 at commit b4a5bb8). That swaps the lobby's active layout to the QUEST dungeon and teleports players to the quest spawn (e.g. (14,14) for crystal_rescue) while gamePhase is still 'lobby' and the client still renders the hub at the old position.

Result: server validates movement against the quest layout, client shows the hub — WASD appears to do nothing (server position pinned at quest spawn), booth interactions fail (server thinks player is out of range of hub anchors). Reloading the page does not help. In practice any quest other than the default is unplayable through the normal lobby flow; I had to use window.__launchReadyUpForTest() to play levels 2-4.

REPRO
1. Register a fresh account, enter the hub lobby.
2. Emit SELECT_QUEST for crystal_rescue (or pick it via the quest board once that UI bug is fixed — see the quest-board bead).
3. Try to move with WASD: hub still renders, player does not move; server-side player.x/z is the quest spawn.
4. Press F at any hub booth: nothing opens.

FIXED WHEN
Selecting a quest in the lobby only records selectedQuestId/Tier (and previews it); layout swap + assignRunSpawnPositions happen at ready-up/run start. After selecting a quest, players can still walk the hub and use booths.

NOTE: code refs are at commit b4a5bb8 (factory merges frequently — line numbers may have drifted; search for applyLayoutForQuest / assignRunSpawnPositions in the SELECT_QUEST handler).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
