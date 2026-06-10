# Server: player movement triggers up to 20 synchronous disk writes/sec per player on the game-loop thread

## Difficulty: medium

## Goal

Every MOVE packet sets player.persistenceDirty = true (game/server/socketHandlers/runHandlers.js:149), and flushDirtyPlayerSaves() runs in both the lobby and playing branches of the 20Hz tick (game/server/simulation.js:607-615, game/server/index.js:1399,1404), calling savePlayerData() per dirty player. FileProvider.savePlayer (game/server/providers.js:44-51) is fs.writeFileSync + renameSync of the full player JSON. One moving player = up to 20 blocking write+rename pairs/sec; 16 players = ~320/sec, all on the event loop that runs combat simulation — tick stutter and SSD churn at any real load. Fix: debounce per-player saves (flush a dirty player at most once every 3-5s; positions are already re-saved by the 30s PERIODIC_SAVE_INTERVAL_MS and on disconnect/leave), or move writes to fs.promises with a per-player in-flight guard. Found in code review 2026-06-09.

## Acceptance Criteria

- A continuously moving player produces bounded disk writes (<=1 per few seconds), saves still happen on disconnect/leave/periodic interval, and no save is lost on clean shutdown; a test covers the debounce

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
