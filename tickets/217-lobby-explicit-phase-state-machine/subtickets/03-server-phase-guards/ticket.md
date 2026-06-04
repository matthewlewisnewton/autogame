# 03 — Migrate server phase checks to PHASES helpers

Replace scattered string comparisons (`gamePhase !== 'lobby'`, `=== 'playing'`, etc.) across server modules with `PHASES` and small helpers so guards read from one definition. Read paths only — no behavior change.

## Acceptance Criteria

- **Depends on** sub-ticket `02-route-phase-writes` (`.passed`).
- `game/server/lobbies.js` exports helpers such as `isLobbyPhase(state)` and `isPlayingPhase(state)` (or equivalent) used by handlers.
- `game/server/index.js`: all ~17 `gamePhase` guard comparisons use `PHASES`/helpers instead of bare `'lobby'` / `'playing'` strings (including `joinPlayerToLobby` branches at ~822–827 and disconnect paths ~891–982).
- `game/server/progression.js`, `game/server/simulation.js`, `game/server/cardEffects.js`, `game/server/keyItemEffects.js`: phase checks use `PHASES`/helpers; no new direct string literals for phase names in these files.
- `game/server/index.js` global fallback `gameState` init (~line 90) uses `PHASES.LOBBY`.
- `pnpm test:quick` passes; lobby integration tests (`vitest run server/test/integration.test.js -t "Lobby"`) still pass.

## Technical Specs

- **`game/server/lobbies.js`**: Add and export `isLobbyPhase`, `isPlayingPhase` (compare `state.gamePhase` to `PHASES.*`).
- **`game/server/index.js`**: Import `PHASES` + helpers; update socket handlers (`playerReady`, `selectQuest`, `move`, `useCard`, trade/shop handlers, telepipe/run handlers, etc.) and `joinPlayerToLobby` / `softDisconnectPlayerFromLobby`.
- **`game/server/progression.js`**: Guards at ~774, 1613, 2099, 2792, 3328.
- **`game/server/simulation.js`**: ~line 298 tick guard.
- **`game/server/cardEffects.js`**: ~line 162.
- **`game/server/keyItemEffects.js`**: ~line 53.
- **Out of scope**: `game/client/**` string comparisons (unchanged for this ticket).

## Verification: code
