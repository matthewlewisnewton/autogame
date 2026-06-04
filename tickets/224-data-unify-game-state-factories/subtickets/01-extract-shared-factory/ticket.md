# 01-extract-shared-factory

Extract the game-state shape into a single factory module so `createGameState` and `createLobbyGameState` both delegate to the same definition.

Currently `createGameState` (`index.js`) has 3 fields (`enchantments`, `lobby`, `_pendingVolatileExplosions`) that `createLobbyGameState` (`lobbies.js`) lacks — causing latent `undefined` errors when lobby-created state is used in combat. Because `index.js` requires `lobbies.js`, a shared module avoids circular dependency.

## Acceptance Criteria

- [ ] A new file `game/server/game-state.js` exports a `createGameState()` function returning the canonical state shape (all fields from the current `index.js` version)
- [ ] `game/server/index.js` imports `createGameState` from `./game-state` instead of defining it locally (keeps the same export name)
- [ ] `game/server/lobbies.js` imports `createGameState` from `./game-state` and re-exports it as `createLobbyGameState` (or directly uses `createGameState` where `createLobbyGameState` was called)
- [ ] The module-level `gameState` singleton in `index.js` still initializes correctly
- [ ] All existing tests pass (`pnpm test` from `game/`)

## Technical Specs

- **New file:** `game/server/game-state.js` — exports `createGameState()` and re-exports `DEFAULT_QUEST_ID` dependency (or imports it)
- **Edit:** `game/server/index.js` — replace local `createGameState` definition with `const { createGameState } = require('./game-state')`; keep `module.exports.createGameState`
- **Edit:** `game/server/lobbies.js` — replace local `createLobbyGameState` body with a call to the shared factory; update `module.exports` to keep backward compat (`createLobbyGameState` export)
- **Constraint:** `index.js` line-184 `require('./lobbies')` must not create a cycle — the shared module must NOT require `index.js` or `lobbies.js`

## Verification: code
