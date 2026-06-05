# 02 — Server inbound listener constants

Replace every game `socket.on('…')` string literal in the extracted handler modules with imports from the shared event catalog. Inbound events are only registered in `game/server/socketHandlers/` after ticket 210 handler extraction.

## Acceptance Criteria

- `game/server/socketHandlers/lobbyHandlers.js`, `deckHandlers.js`, `runHandlers.js`, `tradeHandlers.js`, and `keyItemHandlers.js` import `CLIENT_TO_SERVER` (or equivalent) from `game/shared/events.js`.
- No string literal remains as the first argument to `socket.on(` for custom game events in those five files. Socket.IO built-in `disconnect` stays a literal string (same treatment as client `connect` / `connect_error`).
- Handler behavior is unchanged: same event names on the wire, same payloads and branching.
- `cd game && pnpm test:quick` passes (integration / lobby tests still receive the same event names).

## Technical Specs

- **Edit:** `game/server/socketHandlers/lobbyHandlers.js` — `listLobbies`, `createLobby`, `joinLobby`, `leaveLobby`, `selectQuest`, `unlockHat`, `applyAppearanceChange`, `medicHeal`, `boothInteract`, `debugScenario`, `toggleDebugGodmode`, `heartbeat` (`disconnect` handler keeps literal `'disconnect'`).
- **Edit:** `game/server/socketHandlers/deckHandlers.js` — `deckAddCard`, `deckRemoveCard`, `evolveCard`, `buyShopCard`, `sellCard`, `grindCard`, `playerReady`.
- **Edit:** `game/server/socketHandlers/runHandlers.js` — `returnToLobby`, `giveUp`, `abandonRun`, `claimCardReward`, `move`, `useCard`, `discardCard`, `lootPickup`.
- **Edit:** `game/server/socketHandlers/tradeHandlers.js` — `offerCardTrade`, `respondCardTrade`.
- **Edit:** `game/server/socketHandlers/keyItemHandlers.js` — `equipKeyItem`, `useKeyItem`.
- Use `socket.on(CLIENT_TO_SERVER.MOVE, …)` style (or destructured imports); do not migrate `.emit` calls in this sub-ticket.

## Verification: code
