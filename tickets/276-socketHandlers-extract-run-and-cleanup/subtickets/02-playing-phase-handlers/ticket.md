# 02 — Extract playing-phase run socket handlers

Move in-dungeon gameplay socket handlers from `lobbyHandlers.js` into `runHandlers.js`, completing the run-handler extraction. After this sub-ticket, `lobbyHandlers.js` should only register lobby-browser, cosmetic/medic, and connection-adjacent handlers plus delegate to sub-modules.

## Acceptance Criteria

- The following handlers are registered only in `runHandlers.register` with no inline copies left in `lobbyHandlers.js`:
  - `move`
  - `useCard`
  - `discardCard`
  - `lootPickup`
- Handler bodies are behavior-preserving: same phase checks, payload validation, sequence guards, normalization, persistence flags, and emits.
- `useCard` remains a thin delegate to `cardEffects.handleUseCard` through lobby context.
- `lobbyHandlers.js` contains no run-lifecycle or playing-phase `socket.on` bodies (only `runHandlers.register` delegation for those concerns).
- `disconnect`, `heartbeat`, and `debugScenario` remain in `lobbyHandlers.js` unchanged.
- `index.js` connection handler remains limited to identity setup → `lobbyHandlers.register(socket, ctx)` → resume/init epilogue.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/socketHandlers/runHandlers.js`
  - Move handler bodies from `lobbyHandlers.js` (~L306–440):
    - `move` — input validation, sequence dedup, `inputDx`/`inputDz`/`inputRotation`, `persistenceDirty`
    - `useCard` — `cardEffects.handleUseCard(socket, state, lobby, data)`
    - `discardCard` — phase/run guards, `discardCardFromHand`, `stateUpdate` broadcast
    - `lootPickup` — radius check, currency/MS/crystal handling, `savePlayerData`, `checkRunTerminalState`
  - Import `LOOT_PICKUP_RADIUS` from `../config` and progression helpers (`discardCardFromHand`, `addMagicStones`, `recordCrystalCollected`, `checkRunTerminalState`, `stateSnapshot`, `savePlayerData`).
  - Extend `ctx` destructuring: `withLobbyFromSocket`, `isPlayingPhase`, `cardEffects`, `io`, etc.
- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - Remove the four playing-phase handler registrations and trim imports now unused (`LOOT_PICKUP_RADIUS`, `discardCardFromHand`, `addMagicStones`, `recordCrystalCollected`, `checkRunTerminalState`, `cardEffects`, etc.).
  - Keep `runHandlers.register(socket, ctx)` call.
- Do not remove dead shop/key-item handlers or extract `notifyPlayerRemoved` in this sub-ticket.

## Verification: code
