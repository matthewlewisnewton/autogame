# 02-smoke-test-key-parity

Add a unit test asserting that the shared factory produces the same key set regardless of which export name is used, catching future drift if one caller adds fields without updating the other.

## Acceptance Criteria

- [ ] A test in `game/server/test/game_state.test.js` (or added to existing `server.test.js`) asserts that `Object.keys(createGameState())` and `Object.keys(createLobbyGameState())` are identical
- [ ] The test also asserts that the 3 previously-missing keys (`enchantments`, `lobby`, `_pendingVolatileExplosions`) are present in the factory output
- [ ] Test passes with `pnpm test` from `game/`

## Technical Specs

- **New or edited file:** `game/server/test/server.test.js` — add a new `describe('state factory parity')` block (or a dedicated `game/server/test/game_state.test.js`)
- Import both `createGameState` and `createLobbyGameState` from their respective modules and compare `Object.keys()`
- Assert specific keys: `enchantments`, `lobby`, `_pendingVolatileExplosions` are arrays in the output

## Verification: code
