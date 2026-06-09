# 09 — Restore batched movement persistence saves

Round-1 review reported `persistence_save_triggers.test.js` failing because `savePlayer` is never called after `runGameLoopTick()` following a successful `move` — batched movement persistence regressed. Movement input should mark the player dirty and flush exactly once per tick via `flushDirtyPlayerSaves`.

## Acceptance Criteria

- `cd game && pnpm exec vitest run server/test/persistence_save_triggers.test.js -t "move handler calls savePlayerData"` exits `0`.
- `cd game && pnpm exec vitest run server/test/persistence_save_triggers.test.js -t "batches savePlayerData to at most once per tick"` exits `0`.
- After `summon-ready` deploy, emitting `move` changes position and, following `runGameLoopTick()`, `provider.savePlayer` is called at least once with persisted `x` close to the live player position.
- Ten `move` packets in one tick produce **zero** `savePlayer` calls before the tick and **exactly one** call after `runGameLoopTick()`.
- `cd game && pnpm test:quick` exits `0`.
- `cd game && pnpm test` exits `0` (full harness vitest gate from the top-level ticket).

## Technical Specs

- **Edit:** `game/server/socketHandlers/runHandlers.js` — `CLIENT_TO_SERVER.MOVE` handler must set `player.persistenceDirty = true` on successful input acceptance (playing or lobby phase), deferring writes to the tick flush (comment at ~line 148).
- **Edit:** `game/server/simulation.js` — `applyPlayerMovement` keeps flagging `persistenceDirty` on actual displacement; `flushDirtyPlayerSaves()` iterates dirty players and calls the registered `_savePlayerData` callback once each.
- **Edit:** `game/server/index.js` — `runGameLoopTick()` must call `flushDirtyPlayerSaves()` in both lobby and playing branches **after** `applyPlayerMovement` (currently ~lines 1389–1396); ensure `setSavePlayerCallback(savePlayerData)` remains wired at startup.
- **Reuse:** `savePlayerData` / `persistenceKey` in `progression.js`; unit coverage in `server/test/applyPlayerMovement.test.js` (`flushDirtyPlayerSaves` describe block).
- **Do not change:** `game/server/test/persistence_save_triggers.test.js` unless the batched-save contract changed in design.
- **Scope:** persistence batching only; no validation artifact or playthrough changes.

## Verification: code
