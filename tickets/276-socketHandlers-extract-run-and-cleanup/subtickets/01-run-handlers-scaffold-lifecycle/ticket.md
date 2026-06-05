# 01 — Run handlers module scaffold and lifecycle extraction

Create `game/server/socketHandlers/runHandlers.js` with a `register(socket, ctx)` entry point and move run-lifecycle socket handlers out of `lobbyHandlers.js`. This establishes the run-handler module before playing-phase handlers land in the next sub-ticket.

## Acceptance Criteria

- `game/server/socketHandlers/runHandlers.js` exists and exports `register(socket, ctx)`.
- `lobbyHandlers.register` calls `runHandlers.register(socket, ctx)`; no inline copies of these handlers remain in `lobbyHandlers.js`:
  - `returnToLobby`
  - `giveUp`
  - `abandonRun`
  - `claimCardReward`
- Handler bodies are moved verbatim with identical guards, helper calls, emits, and error paths (including `giveUp` try/catch logging).
- `runHandlers.js` does not `require('./index')` or create circular imports; it reads connection helpers from `ctx` only.
- Playing-phase handlers (`move`, `useCard`, `discardCard`, `lootPickup`) remain in `lobbyHandlers.js` for this sub-ticket.
- `index.js` connection handler is unchanged in this sub-ticket.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **New file:** `game/server/socketHandlers/runHandlers.js`
  - Export `function register(socket, ctx) { … }`.
  - Move handler bodies from `lobbyHandlers.js` (~L244–304):
    - `returnToLobby` → `withLobbyFromSocket`, `returnPlayersToLobby`, `runError`
    - `giveUp` → `isPlayingPhase`, `giveUpRun`, `runAbandoned` / `runError`
    - `abandonRun` → `suspendedCheckpoint` check, `abandonSuspendedRun`
    - `claimCardReward` → `claimCardReward`, `savePlayerData`, `cardRewardClaimed`
  - Import from `../progression` and `../lobbies` only what the moved bodies need (`isPlayingPhase`, `savePlayerData`, `claimCardReward`, etc.).
  - Destructure from `ctx`: `withLobbyFromSocket`, `returnPlayersToLobby`, `giveUpRun`, `abandonSuspendedRun`, `savePlayerData`, and any other helpers referenced by the moved bodies.
- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - `const runHandlers = require('./runHandlers');` near top.
  - Call `runHandlers.register(socket, ctx)` inside `register` (alongside `deckHandlers` / `tradeHandlers` / `keyItemHandlers`).
  - Remove the four lifecycle handler registrations and trim imports now unused by remaining lobby handlers.
  - Update module header comment to note run handlers live in `runHandlers.js`.
- Do not move playing-phase handlers, remove dead handlers, or touch `notifyPlayerRemoved` in this sub-ticket.

## Verification: code
