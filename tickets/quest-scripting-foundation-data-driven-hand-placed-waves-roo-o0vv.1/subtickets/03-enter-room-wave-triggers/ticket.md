# Enter-room wave triggers

Arm `trigger: 'enter_room'` waves at run start but defer spawning until an active player enters the bound room; support room binding by `{ x, z }` room center or by `landmark` type on the deterministic layout.

## Acceptance Criteria

- `enter_room` waves stay `pending` with zero spawned enemies until a non-extracted, non-dead player enters the trigger room; they do not spawn at deploy.
- Room binding `{ x, z }` resolves to the layout room whose center matches (use the same room lookup pattern as tests' `roomAt(layout, x, z)`).
- Room binding `landmark: 'arena_dais'` (etc.) resolves via `layout.landmarks` position, then the containing room.
- Entering the room spawns all authored `spawns` at their coordinates; wave status becomes `spawned`.
- Re-entering the room does not re-spawn the wave.
- Unit test: fixture with `run_start` wave in start room + `enter_room` wave in a distant room; simulate player movement into the distant room and assert delayed spawn.

## Technical Specs

- **`game/server/questScript.js`**: Add `resolveWaveRoom(layout, roomBinding)`, `isPlayerInRoom(player, room)`, `updateEnterRoomTriggers(gameState, ctx)`. Compare player `(x, z)` against room AABB each tick.
- **`game/server/progression.js`**: Export `updateQuestScriptTriggers(now, gameState)` delegating to enter-room checks (and later chaining in sub-ticket 04).
- **`game/server/index.js`**: Call `updateQuestScriptTriggers` from `runGameLoopTick` alongside `updateEncounterTriggers` / `updateSurviveSpawns` when `isPlayingPhase`.
- **`game/server/test/quest_script_enter_room.test.js`** (new): Deterministic layout via `generateLayout(questLayoutSeed(...))`; set player position outside then inside trigger room; tick trigger updater; assert spawn timing and positions.

## Verification: code
