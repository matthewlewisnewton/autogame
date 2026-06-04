# 02 — Route all gamePhase writes through setPhase

Replace every direct `state.gamePhase = '…'` / `_gameState.gamePhase = '…'` assignment on the server with `setPhase` from `lobbies.js`. Transition rules stay the same; this is a pure refactor.

## Acceptance Criteria

- **Depends on** sub-ticket `01-phase-api` (`.passed`).
- Zero direct `gamePhase =` assignments remain under `game/server/` except inside `setPhase` itself (grep confirms).
- All former write sites call `setPhase` with the correct lobby object or a small helper `setGamePhase(state, nextPhase)` that resolves the lobby via `state._lobbyId` / `getLobbyById` when only `GameState` is in scope (used from `progression.js` inside `withLobbyContext`).
- Covered write paths still behave as before: `enterPlayingPhase` (`index.js`), `checkAllReady` deploy (`progression.js`), `suspendRunToLobby`, `returnPlayersToLobby`, `giveUpRun`, `abandonSuspendedRun`, and the three resets in `debugScenarios.js`.
- `pnpm test:quick` passes (no new gameplay behavior).

## Technical Specs

- **`game/server/lobbies.js`**: If needed, add `setGamePhase(state, nextPhase)` that looks up the lobby by `state._lobbyId` and delegates to `setPhase`, or accept `setPhase` on `{ state }` lobby stubs used in tests.
- **`game/server/index.js`**: `enterPlayingPhase` — replace `state.gamePhase = 'playing'` with `setPhase(lobby, PHASES.PLAYING)`.
- **`game/server/progression.js`**: Replace assignments at `suspendRunToLobby`, `abandonSuspendedRun`, `returnPlayersToLobby`, `giveUpRun`, `checkAllReady` (~lines 3022, 3122, 3278, 3335, 3391) with `setGamePhase` / `setPhase`.
- **`game/server/debugScenarios.js`**: Route the three `state.gamePhase = 'lobby'` writes through `setPhase`.

## Verification: code
