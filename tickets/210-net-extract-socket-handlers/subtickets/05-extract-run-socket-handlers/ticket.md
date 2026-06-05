# 05 — Extract run/dungeon socket handlers and slim connection closure

Move all in-run and run-lifecycle socket handlers into `socketHandlers/run.js`, leaving the `io.on('connection')` block as session setup, `ctx` construction, `registerAll`, resume/reconnect, `init` emit, and `broadcastLobbyList` only.

## Acceptance Criteria

- `game/server/socketHandlers/run.js` exports `register(socket, ctx)` for: `move`, `useCard`, `discardCard`, `returnToLobby`, `giveUp`, `abandonRun`, `claimCardReward`, `lootPickup`.
- `useCard` remains a thin `withLobbyFromSocket` wrapper around `cardEffects.handleUseCard`; `discardCard` / loot / run lifecycle logic unchanged.
- `registerAll` registers the run module last (order only matters if a future handler depended on registration sequence — preserve current registration order among run handlers).
- The `io.on('connection')` handler in `game/server/index.js` is substantially reduced: no remaining per-event `socket.on` except what sub-tickets 01–04 already moved (none left in index).
- `cd game && pnpm test:quick` passes, including run/integration tests (movement, loot, suspend/abandon, card discard).

## Technical Specs

- **New:** `game/server/socketHandlers/run.js` — move handlers ~L1231–1303 and ~L1358–1888 (`move` through `lootPickup`; exact lines after prior extractions).
- **Edit:** `game/server/socketHandlers/ctx.js` — include run helpers: `withLobbyFromSocket`, `isPlayingPhase`, `isLobbyPhase`, `stateSnapshot`, `cardEffects`, `discardCardFromHand`, `claimCardReward`, `giveUpRun`, `abandonSuspendedRun`, `returnPlayersToLobby`, `checkRunTerminalState`, `LOOT_PICKUP_RADIUS`, `recordCrystalCollected`, `addMagicStones`, etc., via `ctx` or explicit requires of `simulation`/`progression` modules (not `index.js`).
- **Edit:** `game/server/socketHandlers/index.js` — register run module.
- **Edit:** `game/server/index.js` — connection closure only: auth identity, `buildPlayerRecord` / `registerSession`, `createSocketHandlerCtx` + `registerAll`, resume/reconnect block, `socket.playerId`, `init` emit, `broadcastLobbyList`.

## Verification: code
