# 04 — Extract lobby-phase quest, ready, key item, medic, and trade handlers

Move the remaining lobby-phase socket handlers that use `withLobbyPlayer` (including custom `phaseMismatch` options) into `lobbyHandlers.js`. `playerReady` must keep its no-`requirePhase` entry guard and `checkAllReady` only when `isLobbyPhase(state)`.

## Acceptance Criteria

- These events are registered only through `lobbyHandlers.js`: `selectQuest`, `playerReady`, `equipKeyItem`, `medicHeal`, `offerCardTrade`, `respondCardTrade`.
- `equipKeyItem` and `medicHeal` preserve `phaseMismatch` emits (`keyItemError` / `medicError` with `{ reason: 'not_in_lobby' }`).
- `playerReady` still omits `requirePhase`; deck validation / `deckError` / `broadcastLobbyUpdate` / conditional `checkAllReady` unchanged.
- Trade handlers still resolve peer sockets via `findSocketByPlayerId` and emit the same `tradeUpdate` / `tradeOffer` / `cardInventoryUpdate` payloads.
- No duplicate `socket.on` for the above events in `index.js`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/socketHandlers/lobbyHandlers.js` — register functions for the six events; wire in `registerLobbyHandlers`.
- **Edit:** `game/server/index.js` — extend `ctx` with: `isValidQuestId`, `applyLayoutForQuest`, `assignRunSpawnPositions`, `buildQuestUpdatePayload`, `stateSnapshot`, `broadcastLobbyUpdate`, `checkAllReady`, `isLobbyPhase`, `getKeyItemDef`, `healAtMedic`, `offerCardTrade`, `respondCardTrade`, `findSocketByPlayerId`, `io`, etc.
- Source lines to move: ~1319–1840 (`selectQuest` through `respondCardTrade`), excluding handlers already migrated in sub-tickets 01–03.

## Verification: code
