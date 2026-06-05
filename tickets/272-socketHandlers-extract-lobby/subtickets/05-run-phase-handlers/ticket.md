# 05 — Extract run / playing-phase socket handlers

Move dungeon-run socket handlers from `index.js` into `lobbyHandlers.js`. These are the handlers that use `withLobbyFromSocket` for in-lobby play (movement, cards, run lifecycle, loot, key items). Delegate to existing modules (`cardEffects`, `keyItemEffects`) where `index.js` already does.

## Acceptance Criteria

- These events are registered only through `lobbyHandlers.js`: `move`, `useCard`, `discardCard`, `returnToLobby`, `giveUp`, `abandonRun`, `claimCardReward`, `useKeyItem`, `lootPickup`.
- Phase guards and payloads unchanged (`isPlayingPhase` checks on `move` / `discardCard`, `runError` reasons, `cardEffects.handleUseCard`, `keyItemEffects.handleUseKeyItem`, loot distance / `LOOT_PICKUP_RADIUS`, crystal `checkRunTerminalState`).
- No duplicate `socket.on` for the above events in `index.js`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/socketHandlers/lobbyHandlers.js` — register functions for the nine events; wire in `registerLobbyHandlers`.
- **Edit:** `game/server/index.js` — extend `ctx` with: `withLobbyFromSocket`, `isPlayingPhase`, `isLobbyPhase` (if needed), `cardEffects`, `keyItemEffects`, `discardCardFromHand`, `giveUpRun`, `returnPlayersToLobby`, `abandonSuspendedRun`, `claimCardReward`, `savePlayerData`, `stateSnapshot`, `LOOT_PICKUP_RADIUS`, `addMagicStones`, `recordCrystalCollected`, `checkRunTerminalState`, etc.
- Source lines to move: ~1245–1412 and ~1865–1901 (`move` through `claimCardReward`, `useKeyItem`, `lootPickup`).
- **Leave in index.js** for sub-ticket 06: `disconnect`, `debugScenario`, `heartbeat`, connection `init` / resume-reconnect preamble.

## Verification: code
