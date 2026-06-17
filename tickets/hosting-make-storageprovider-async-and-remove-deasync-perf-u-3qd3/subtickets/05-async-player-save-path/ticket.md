# Async player save path and full-suite completion

Sub-tickets 01 (async providers) and 04 (admin/startup + settings wiring) are done; player **load** is already async (`loadSavedPlayerData`, admin roster). The remaining gap is the **save** side: `savePlayerData` still calls `provider.savePlayer(...)` synchronously and returns before the write finishes, so hat-unlock ordering and persistence tests cannot rely on awaited I/O. Make `savePlayerData`/`saveAllPlayers` async, propagate `await`/`void` through every caller, update persistence tests, and confirm the full server suite passes with the already-async settings API intact.

## Acceptance Criteria

- `game/server/progression.js` — `savePlayerData` is `async`, awaits `provider.savePlayer(key, extractPersistentData(player))`, and preserves try/catch boolean return semantics; `saveAllPlayers` is `async` and `await`s each `savePlayerData`.
- Return-value call sites that gate rollback (`lobbyHandlers.js` hat unlock and paid appearance change) use `const saved = await savePlayerData(...)` and still refund currency / abort unlock when `saved === false`.
- All other `savePlayerData` call sites use `void savePlayerData(...)` (or `await` inside an already-async helper) so no raw Promise leaks and the simulation tick loop is not blocked.
- `saveAllPlayersInAllLobbies` in `index.js` and the simulation debounce callback (`simulation.js` `_savePlayerData`) work with async saves without synchronous provider calls on the hot path.
- Any helper made async as part of save propagation (e.g. `returnPlayersToLobby` if it calls `savePlayerData`) is awaited by its callers.
- `game/server/test/persistence.test.js`, `persistence_save_debounce.test.js`, `persistence_save_triggers.test.js`, and any other failing persistence-related tests `await savePlayerData(...)` and `await provider.loadPlayer(...)`; throwing-provider mocks return rejected Promises where appropriate.
- `pnpm test:quick` in `game/` exits 0 (full server + client suite); `account.test.js` settings PATCH cases pass; no `deasync` / `runSync` references under `game/`.

## Technical Specs

- **`game/server/progression.js`**
  - `savePlayerData` → `async`; `await provider.savePlayer(...)`.
  - `saveAllPlayers` → `async`; `await savePlayerData` per player.
  - Internal call sites (`healAtMedic`, telepipe extract, run terminal, `returnPlayersToLobby`, etc.) → `void savePlayerData(...)` or `await` as appropriate; make `returnPlayersToLobby` async if it saves inside.
- **`game/server/index.js`**
  - `saveAllPlayersInAllLobbies` → wrap body with `void saveAllPlayers()` (or make async and void-invoke from interval).
  - Disconnect / cleanup paths that call `savePlayerData` → `void savePlayerData(...)`.
  - Connection handler already awaits `loadSavedPlayerData`; no change needed there.
- **`game/server/socketHandlers/lobbyHandlers.js`**
  - Hat unlock + appearance handlers: convert the `withLobbyContext` body to an async flow so `await savePlayerData` works; keep currency-first / hat-second ordering.
- **`game/server/socketHandlers/deckHandlers.js`**, **`runHandlers.js`**, **`tradeHandlers.js`**, **`keyItemHandlers.js`**
  - `void savePlayerData(...)` in each handler; `await returnPlayersToLobby` if that helper becomes async.
- **`game/server/keyItemEffects.js`**, **`game/server/simulation.js`**
  - Fire-and-forget saves via `void _savePlayerData(playerId)` / `void savePlayerData(...)`.
- **`game/server/test/persistence.test.js`**
  - `await savePlayerData(...)` in async tests; sync tests that assert immediate side effects use `await` or `vi.useFakeTimers` + flush; throwing mocks use `mockRejectedValue` / async throw.
- **`game/server/test/persistence_save_debounce.test.js`**, **`persistence_save_triggers.test.js`**
  - Await saves and provider reads.
- **`game/server/test/server.test.js`**, **`integration.test.js`**, **`overclock.test.js`**
  - Update any `returnPlayersToLobby()` / `savePlayerData()` calls affected by async propagation.
- **Do not modify** subticket folders `01-async-storage-providers` or `04-async-admin-startup-and-suite` (already `.passed`). Settings async in `settings.js` / `account.js` is already done — leave intact.

## Verification: code
