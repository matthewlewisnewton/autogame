# 03-extract-run-handlers

Extract dungeon/run-phase socket handlers from `index.js` into `socketHandlers/run.js`, keeping thin delegators for `useCard` (→ `cardEffects`) identical to today.

This slice covers movement, combat hand management, quest/deploy flow, run suspend/abandon, rewards, loot, and medic heal.

## Acceptance Criteria

- [ ] New `game/server/socketHandlers/run.js` exports `register(socket, ctx)` registering: `move`, `useCard`, `discardCard`, `selectQuest`, `playerReady`, `returnToLobby`, `giveUp`, `abandonRun`, `claimCardReward`, `lootPickup`, `medicHeal`
- [ ] `useCard` handler remains a one-liner delegating to `cardEffects.handleUseCard(socket, state, lobby, data)` inside `withLobbyFromSocket`
- [ ] `registerAllSocketHandlers` calls `run.register(socket, ctx)`
- [ ] No inline `socket.on(...)` for those eleven events remain in `game/server/index.js`
- [ ] `pnpm test` from `game/` is green (run/combat/integration tests pass)

## Technical Specs

- **New:** `game/server/socketHandlers/run.js` — move handler bodies from `index.js` (~L1180–1372, L1654–1675, L1840–1877); import or receive via ctx: `cardEffects`, progression helpers (`discardCardFromHand`, `stateSnapshot`, `checkAllReady`, `returnPlayersToLobby`, `giveUpRun`, `abandonSuspendedRun`, `claimCardReward`, `healAtMedic`, `addMagicStones`, `recordCrystalCollected`, `checkRunTerminalState`), layout helpers (`applyLayoutForQuest`, `assignRunSpawnPositions`, `buildQuestUpdatePayload`, `isValidQuestId`), deck validation (`validateDeck`, `normalizePlayerInventory`), constants (`LOOT_PICKUP_RADIUS`)
- **Edit:** `game/server/socketHandlers/context.js` — pass through any run-specific deps
- **Edit:** `game/server/socketHandlers/index.js` — wire `run.register`
- **Edit:** `game/server/index.js` — remove extracted inline handlers

## Verification: code
