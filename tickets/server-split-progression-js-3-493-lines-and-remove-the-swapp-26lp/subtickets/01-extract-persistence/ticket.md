# Extract persistence module (explicit state, no _gameState)

Move player save/load and the persistence provider out of `progression.js` into a focused module. This is the smallest seam called out in the parent ticket: `savePlayerData`, `saveAllPlayers`, `extractPersistentData`, `persistenceKey`, and provider wiring (`setTestProvider`, `getProvider`).

## Acceptance Criteria

- New file `game/server/progression/persistence.js` owns provider setup, `extractPersistentData`, `persistenceKey`, `savePlayerData`, and `saveAllPlayers`.
- `savePlayerData` and `saveAllPlayers` take lobby `state` as their first argument (e.g. `savePlayerData(state, playerId)`); `persistenceKey` takes `(state, playerId)`.
- `game/server/progression/persistence.js` contains **no** module-level `_gameState` and no `setGameState`/`getGameState`.
- `game/server/progression.js` re-exports the persistence API unchanged for existing importers; internal persistence helpers no longer read `_gameState` directly.
- Call sites that invoke save functions (`game/server/index.js` `setSavePlayerCallback`, `game/server/socketHandlers/keyItemHandlers.js`, and any other direct callers) pass `state` explicitly.
- `pnpm test:quick` from `game/` passes.

## Technical Specs

- **Create** `game/server/progression/persistence.js` — move `provider`, `setTestProvider`, `getProvider`, `extractPersistentData`, `persistenceKey`, `savePlayerData`, `saveAllPlayers` from `progression.js`. `extractPersistentData` may still call `normalizePlayerInventory` imported from `progression.js` until sub-ticket 02 lands.
- **Edit** `game/server/progression.js` — delete moved implementations; `require('./progression/persistence')` and re-export; replace direct `_gameState` reads inside save paths with the new `state` parameter.
- **Edit** `game/server/index.js` — update `setSavePlayerCallback` wiring so the simulation callback receives and forwards lobby `state`.
- **Edit** `game/server/socketHandlers/keyItemHandlers.js` — pass lobby `state` into `savePlayerData`.
- Keep `initProgression` in `progression.js` for now; it may still set `_gameState` for unmigrated domains.

## Verification: code
