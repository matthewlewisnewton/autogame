# 03 — Extract run / dungeon socket handlers

Move in-run and run-lifecycle socket handlers into `game/server/socketHandlers/run.js`. Card combat stays delegated to `cardEffects.handleUseCard` exactly as today.

## Acceptance Criteria

- `game/server/socketHandlers/run.js` exports `register(socket, ctx)` registering: `move`, `useCard`, `discardCard`, `selectQuest`, `playerReady`, `returnToLobby`, `giveUp`, `abandonRun`, `claimCardReward`, `lootPickup`.
- `useCard` still calls `cardEffects.handleUseCard(socket, state, lobby, data)` inside `withLobbyFromSocket` / `withLobbyPlayer` wrappers — no logic duplication into `cardEffects.js`.
- No inline `socket.on` for those ten events remains in the connection closure.
- `index.js` calls `run.register(socket, ctx)`.
- `cd game && pnpm test:quick` passes (including run suspend/resume, movement, loot, and quest tests).

## Technical Specs

- **New:** `game/server/socketHandlers/run.js` — move handlers from `game/server/index.js` (~lines 1225–1412 and 1845–1882).
- **Edit:** `game/server/index.js` — wire `run.register`; drop moved inline handlers.
- **Edit:** `game/server/socketHandlers/context.js` — add run-specific deps (`cardEffects`, `stateSnapshot`, `isPlayingPhase`, `checkAllReady`, `giveUpRun`, `abandonSuspendedRun`, `claimCardReward`, `discardCardFromHand`, `LOOT_PICKUP_RADIUS`, quest/layout helpers, etc.) on `ctx` or as imports inside `run.js` where they do not create circular requires.

## Verification: code
