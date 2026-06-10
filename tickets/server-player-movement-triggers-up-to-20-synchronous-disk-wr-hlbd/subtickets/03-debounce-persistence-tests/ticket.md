# Integration test: continuous movement produces bounded disk writes

## Description

Add an automated test that proves the debounce fix meets the top-level acceptance criterion: a continuously moving player no longer triggers up to 20 synchronous `savePlayer` calls per second, while periodic and lifecycle saves remain intact.

## Acceptance Criteria

- New test file `game/server/test/persistence_save_debounce.test.js` (or equivalent name) uses fake timers and spies on `provider.savePlayer`
- Simulating continuous movement across many 20 Hz game-loop ticks (e.g. 5 seconds = 100 ticks) with `persistenceDirty` set each tick results in **at most** `ceil(elapsedMs / PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS) + 1` `savePlayer` calls via `flushDirtyPlayerSaves`, not one per tick
- The same test (or a sibling case) confirms that calling `savePlayerData(playerId)` directly still invokes `savePlayer` immediately regardless of debounce state
- `game/server/test/persistence_save_triggers.test.js` is updated so the “batches savePlayerData to at most once per tick across many move packets” case reflects debounced behavior (many ticks within the debounce window → one save; advance timers past the window → additional save allowed)
- All server vitest tests pass (`pnpm test:quick` from `game/` or the harness server test target)

## Technical Specs

- **File**: `game/server/test/persistence_save_debounce.test.js` (new)
  - Set up minimal game state with one player, wire `setSavePlayerCallback(savePlayerData)` and a test `InMemoryProvider` or spied `FileProvider`
  - Loop: set `player.persistenceDirty = true`, call `flushDirtyPlayerSaves()`, advance fake timers by `GAME_TICK_MS` (50 ms) for N iterations
  - Assert `savePlayer` call count is bounded per the debounce formula above
  - Separate `it` block: mark player dirty with a fresh `persistenceLastSavedAt` inside the window, call `savePlayerData`, expect immediate `savePlayer` call
- **File**: `game/server/test/persistence_save_triggers.test.js`
  - Update the move-batching integration test (~line 136): after `runGameLoopTick()` once, additional ticks within `PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS` must not increase `savePlayer` call count; advance fake timers beyond the debounce window and run another tick to allow a second save
  - Import `PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS` from `../config` for assertions
- **Dependencies**: sub-tickets `01-debounce-flush-dirty-saves` and `02-lifecycle-and-shutdown-saves` must land first; this ticket only adds/adjusts tests

## Verification: code
