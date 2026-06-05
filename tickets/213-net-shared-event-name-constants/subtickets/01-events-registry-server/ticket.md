# Shared event-name registry + server-side adoption

Create a single canonical registry of Socket.IO event names under `game/shared/`
and replace every magic-string event literal in the **server** emit/`socket.on`
call sites with a reference into that registry. The registry is the single source
of truth that both server and client will import (client + drift test land in
later sub-tickets).

## Acceptance Criteria

- A new file `game/shared/events.json` exists, exporting a flat object that maps
  each canonical event name to its own string value (e.g.
  `"stateUpdate": "stateUpdate"`), covering **all** gameplay socket event names
  used anywhere in the codebase — both server-emitted and client-emitted —
  including at minimum: `init`, `stateUpdate`, `lobbyJoined`, `lobbyLeft`,
  `lobbyListUpdate`, `lobbyUpdate`, `lobbyError`, `createLobby`, `joinLobby`,
  `leaveLobby`, `listLobbies`, `startGame`, `selectQuest`, `questUpdate`,
  `questError`, `playerReady`, `playerReconnected`, `playerDisconnected`,
  `playerExtracted`, `cardUsed`, `cardError`, `useCard`, `discardCard`,
  `volatileExplosion`, `leechHeal`, `shieldBreak`, `keyItemUsed`, `keyItemError`,
  `keyItemEquipped`, `keyItemHealPulse`, `equipKeyItem`, `useKeyItem`,
  `returnToLobby`, `giveUp`, `abandonRun`, `runError`, `runAbandoned`,
  `runSuspended`, `runComplete`, `runFailed`, `claimCardReward`,
  `cardRewardClaimed`, `move`, `lootPickup`, `boothInteract`, `boothAction`,
  `boothError`, `hubPresenceUpdate`, `debugScenario`, `debugScenarioResult`,
  `heartbeat`, `heartbeat_ack`, `unlockHat`, `hatUnlocked`, `hatError`,
  `deckAddCard`, `deckRemoveCard`, `deckUpdate`, `deckError`, `buyShopCard`,
  `sellCard`, `evolveCard`, `cardEvolutionResult`, `cardEvolutionError`,
  `grindCard`, `cardGrindResult`, `cardGrindError`, `cardInventoryUpdate`,
  `tradeOffer`, `tradeUpdate`, `offerCardTrade`, `respondCardTrade`, `medicHeal`,
  `medicHealed`, `medicError`. (Enumerate the real set from the code; the list
  above is the floor, not the ceiling.)
- `game/shared/events.json` does **not** include Socket.IO/Node lifecycle names
  that are not game events: `connection`, `connect`, `disconnect`,
  `connect_error`, `error`, `uncaughtException`, `unhandledRejection`. Those stay
  as literals at their call sites.
- Every gameplay-event string literal passed as the first argument of `.emit(...)`
  or `socket.on(...)` in the server source files listed in Technical Specs is
  replaced by a reference into the imported registry (e.g.
  `EVENTS.stateUpdate`). No game-event string literal remains in those call sites.
- Each touched server file imports the registry via
  `require('../shared/events.json')` (or `'../../shared/events.json'` from the
  `socketHandlers/` subdir) bound to a clear local name such as `EVENTS`.
- The dynamic `runComplete` / `runFailed` emit in `server/progression.js` (around
  line 3198) resolves through the registry constants, not raw strings.
- Existing server tests still pass (`pnpm test` in `game/`); no runtime behavior
  changes — emitted wire names are byte-for-byte identical to before.

## Technical Specs

- New file: `game/shared/events.json` — flat `{ "<name>": "<name>", ... }` JSON
  object. JSON is chosen because the server consumes it with CommonJS
  `require(...)` (see `server/config.js` requiring `../shared/constants.json`) and
  the client consumes it with `import EVENTS from '../shared/events.json' with
  { type: 'json' }` (see `client/config.js`), so a JSON file works unchanged on
  both sides. Do NOT use the ESM-bridge pattern (`*.esm.js` + `*.js`); plain JSON
  is sufficient and matters less.
- Server files to update (replace literals + add the `require`):
  `game/server/index.js`, `game/server/progression.js`,
  `game/server/cardEffects.js`, `game/server/keyItemEffects.js`,
  `game/server/debugScenarios.js`, `game/server/hubPresence.js`, and all of
  `game/server/socketHandlers/*.js` (`deckHandlers.js`, `keyItemHandlers.js`,
  `lobbyHandlers.js`, `runHandlers.js`, `tradeHandlers.js`).
- Find call sites with e.g.
  `grep -rEn "\.(emit|on)\(['\"]" game/server/...` and replace only the
  first-argument event-name literal; leave payload arguments untouched.
- Do NOT touch client files or add the drift test in this sub-ticket (later
  sub-tickets). Do NOT modify `game/server/test/**`.

## Verification: code
