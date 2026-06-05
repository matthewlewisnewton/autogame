# 05 — Extract playing-phase and disconnect socket handlers

Move the remaining `socket.on` handlers from the connection closure into `lobbyHandlers.register`, completing the extraction scoped by the parent ticket. These cover in-dungeon gameplay input, debug tooling, heartbeat, loot pickup, and disconnect cleanup.

## Acceptance Criteria

- The following handlers are registered in `lobbyHandlers.register` with no inline copies left in the connection closure:
  - `move`, `useCard`, `discardCard`, `lootPickup`
  - `debugScenario`, `heartbeat`, `disconnect`
- Handler bodies are behavior-preserving (same guards, sequence checks, phase checks, emits).
- `useCard` remains a thin delegate to `cardEffects.handleUseCard` through lobby context.
- `disconnect` still calls `softDisconnectPlayerFromLobby` when in a lobby, otherwise `lobbies.removeSession`.
- Connection preamble after handler registration (resume lobby, `socket.playerId` assignment, `init` emit, `broadcastLobbyList`) remains in `index.js`.
- No `socket.on` registrations for lobby/run handlers remain inside the `io.on('connection')` closure except connection setup/teardown logic.
- `cd game && pnpm test:quick` passes (full server suite green).

## Technical Specs

- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - Move handler bodies from `index.js` (~L1239–1311 for `move`/`useCard`/`discardCard`; ~L1836–1910 for `debugScenario`/`heartbeat`/`lootPickup`/`disconnect`).
  - Extend `ctx` with: `withLobbyFromSocket`, `withLobbyPlayer`, `isPlayingPhase`, `cardEffects`, `discardCardFromHand`, `stateSnapshot`, `io`, `savePlayerData`, `checkRunTerminalState`, `applyDebugScenario`, `lobbies`, `softDisconnectPlayerFromLobby`, movement/input helpers, loot helpers, etc.
- **Edit:** `game/server/index.js`
  - Remove all remaining inline lobby/run `socket.on` registrations moved above.
  - Keep session setup (~L1163–1172), resume/reconnect block (~L1912–1920), `socket.playerId` assignment, `init` emit (~L1925–1936), and `broadcastLobbyList()` in the connection handler.
  - The connection handler should consist of: identity setup → `lobbyHandlers.register(socket, ctx)` → resume/init epilogue.
- Do not change client code or effect-module semantics.

## Verification: code
