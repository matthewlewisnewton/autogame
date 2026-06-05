# 05 — Extract run, misc handlers and slim connection closure

Move remaining in-dungeon and utility socket events into modules and reduce the `io.on('connection')` closure to session bootstrap, `ctx` construction, sequential `register` calls, reconnect/`init` emit, and `broadcastLobbyList`.

## Acceptance Criteria

- `game/server/socketHandlers/runHandlers.js` exports `register(socket, ctx)` registering: `move`, `useCard`, `discardCard`, `returnToLobby`, `giveUp`, `abandonRun`, and `lootPickup`.
- `game/server/socketHandlers/miscHandlers.js` exports `register(socket, ctx)` registering: `debugScenario`, `heartbeat`, and `disconnect`.
- `useCard` remains a thin delegate to `cardEffects.handleUseCard`; run lifecycle handlers preserve calls to `giveUpRun`, `abandonSuspendedRun`, `returnPlayersToLobby`, `checkRunTerminalState`, etc.
- The connection handler in `index.js` (currently ~L1149–1931) shrinks to: read JWT identity, build session, call every `*.register(socket, ctx)` from `socketHandlers/`, assign `socket.playerId`, emit `init`, handle resume/reconnect — with no remaining inline `socket.on('…')` bodies beyond those register calls.
- Full server test suite is green (`pnpm test` from `game/`), including integration, lobbies, key-items, simulation, and run suspend/resume paths.

## Technical Specs

- **`game/server/socketHandlers/runHandlers.js`** (new): dungeon movement input, card discard, run give-up/abandon/return, loot pickup; import `cardEffects`, `isPlayingPhase`, config constants (`LOOT_PICKUP_RADIUS`), simulation/progression helpers as today.
- **`game/server/socketHandlers/miscHandlers.js`** (new): debug scenario gate, heartbeat ack, disconnect → `softDisconnectPlayerFromLobby` / `lobbies.removeSession`; receive `softDisconnectPlayerFromLobby`, `getLobbyForSocket`, `isDebugScenarioAllowed`, `applyDebugScenario` via `ctx`.
- **`game/server/index.js`**: import and invoke `runHandlers.register` and `miscHandlers.register`; delete all remaining per-event handler closures from the connection block; ensure `cardEffects.setCallbacks` / `keyItemEffects.setCallbacks` wiring still runs at module load.
- **`game/server/socketHandlers/index.js`**: re-export all handler modules for a single import site in `index.js`.

## Verification: code
