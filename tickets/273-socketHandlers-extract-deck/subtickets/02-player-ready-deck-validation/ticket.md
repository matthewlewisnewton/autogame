# 02 — Extract playerReady deck validation handler

Move the `playerReady` socket handler from `lobbyHandlers.js` into `deckHandlers.js`. This handler gates run start on deck validity and quest-tier unlock checks; behavior must remain identical.

## Acceptance Criteria

- `playerReady` is registered only in `deckHandlers.register`; no inline copy remains in `lobbyHandlers.js`.
- Preserved exactly:
  - No `requirePhase` on `withLobbyPlayer` (ready toggling allowed in any phase).
  - Quest-tier unlock check when `ready === true` and `selectedQuestTier >= 2`.
  - `normalizePlayerInventory` + `validateDeck` before accepting ready state.
  - Emits `deckError` / `questError` with the same `{ reason }` payloads; calls `broadcastLobbyUpdate` and `checkAllReady` when in lobby phase.
- `cd game && pnpm test:quick` passes (covers integration tests for `playerReady`, tier gating, and startGame flow).

## Technical Specs

- **Edit:** `game/server/socketHandlers/deckHandlers.js`
  - Move `socket.on('playerReady', …)` body from `lobbyHandlers.js` (~L187–217).
  - Import `DEFAULT_QUEST_TIER` from `../quests`, `isQuestTierUnlocked` from `../users`, and `normalizePlayerInventory`, `validateDeck`, `checkAllReady` from `../progression`.
  - Import `isLobbyPhase` from `../lobbies`.
  - Read from `ctx`: `withLobbyPlayer`, `broadcastLobbyUpdate`.
- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - Remove the `playerReady` handler and trim imports/helpers only used by it (`validateDeck`, `checkAllReady`, `isLobbyPhase`, `isQuestTierUnlocked`, etc.) if no longer referenced.
- Do not modify `index.js`.

## Verification: code
