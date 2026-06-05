# 03 — Server outbound emit constants

Replace every game `.emit('…')` string literal in production server code with imports from `SERVER_TO_CLIENT`. Fix the dynamic run-end emit in `progression.js` so both branches use constants (not inline `'runComplete'` / `'runFailed'` strings).

## Acceptance Criteria

- `game/server/index.js`, `progression.js`, `cardEffects.js`, `keyItemEffects.js`, `debugScenarios.js`, and `hubPresence.js` import shared server-to-client constants and use them for all custom `.emit(` first arguments.
- `game/server/socketHandlers/*.js` outbound `.emit` / `io.emit` / `io.to(…).emit` calls likewise use `SERVER_TO_CLIENT` (handlers emit responses such as `deckUpdate`, `lobbyError`, `tradeOffer`).
- `progression.js` run completion uses constants in the ternary, e.g. `io.emit(status === 'victory' ? SERVER_TO_CLIENT.RUN_COMPLETE : SERVER_TO_CLIENT.RUN_FAILED, summary)` (~L2859).
- No custom event string literals remain in `.emit(` first arguments across the files above (grep check).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/index.js` — `init`, `lobbyListUpdate`, `lobbyJoined`, `lobbyError`, `lobbyUpdate`, `startGame`, `stateUpdate`, `cardError`, `playerReconnected`, `playerDisconnected`, `cardUsed`, `volatileExplosion`, `leechHeal`, `shieldBreak`.
- **Edit:** `game/server/progression.js` — `deckUpdate`, `runSuspended`, `stateUpdate`, `playerExtracted`, `runComplete`/`runFailed`, `startGame`.
- **Edit:** `game/server/cardEffects.js` — `stateUpdate`, `cardUsed`, `cardError`.
- **Edit:** `game/server/keyItemEffects.js` — `keyItemUsed`, `keyItemHealPulse`, `stateUpdate`.
- **Edit:** `game/server/debugScenarios.js` — `questUpdate`, `stateUpdate`, `deckUpdate`.
- **Edit:** `game/server/hubPresence.js` — `hubPresenceUpdate`.
- **Edit:** `game/server/socketHandlers/{lobby,deck,run,trade,keyItem}Handlers.js` — all server→client emits (errors, updates, acks).
- Import via `const { SERVER_TO_CLIENT } = require('../shared/events.js')` (adjust paths per file).

## Verification: code
