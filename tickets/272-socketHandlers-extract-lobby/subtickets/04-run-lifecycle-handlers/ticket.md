# 04 — Extract run lifecycle socket handlers

Move run state transition handlers from the connection closure into `lobbyHandlers.register`. These handlers cover post-run rewards, returning to lobby after a run ends, giving up an active run, and abandoning a suspended expedition.

## Acceptance Criteria

- `returnToLobby`, `giveUp`, `abandonRun`, and `claimCardReward` are registered in `lobbyHandlers.register` — no inline copies remain in `index.js`.
- Handler behavior is preserved:
  - `returnToLobby` rejects when run still playing; calls `returnPlayersToLobby` when run exists and is not active.
  - `giveUp` validates playing phase + active run, calls `giveUpRun`, emits `runAbandoned` or `runError`.
  - `abandonRun` requires `suspendedCheckpoint`, calls `abandonSuspendedRun`.
  - `claimCardReward` validates post-run state, calls `claimCardReward`, emits `cardRewardClaimed`.
- Error paths and try/catch logging in `giveUp` unchanged.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/server/socketHandlers/lobbyHandlers.js`
  - Move handler bodies from `index.js` (~L1366–1426).
  - Use `ctx` helpers: `withLobbyFromSocket`, `isPlayingPhase`, `returnPlayersToLobby`, `giveUpRun`, `abandonSuspendedRun`, `claimCardReward`, `savePlayerData`, `stateSnapshot` (if referenced), etc.
- **Edit:** `game/server/index.js`
  - Remove inline `socket.on('returnToLobby' …)`, `giveUp`, `abandonRun`, `claimCardReward` registrations.
  - Extend `ctx` with any newly required helpers.
- Do not move playing-phase handlers (`move`, `useCard`, etc.) or `disconnect` in this sub-ticket.

## Verification: code
