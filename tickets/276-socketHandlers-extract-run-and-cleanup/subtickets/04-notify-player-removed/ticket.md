# 04 — Extract notifyPlayerRemoved for leave-broadcast dedup

Three code paths in `index.js` duplicate the same post-leave broadcast logic after a player leaves or is evicted from a lobby: emit `playerDisconnected` (when the player is actually removed), then either `checkRunTerminalState()` during a run or `broadcastLobbyUpdate(lobby)` in lobby phase. Extract a shared helper and replace the copy-pasted blocks.

## Acceptance Criteria

- A single helper (named `notifyPlayerRemoved` or equivalent) exists in `game/server/index.js` (or a small adjacent module required by `index.js` without circular imports).
- The helper consolidates the duplicated leave-broadcast sequence used by all three call sites:
  - `softDisconnectPlayerFromLobby` — phase-appropriate lobby/run broadcast after marking disconnected (no `playerDisconnected` emit today; preserve that behavior).
  - `evictDisconnectedPlayers` — after `lobbies.removePlayerFromLobby`, emit `playerDisconnected` and broadcast when lobby survives.
  - `leaveLobbyForSocket` — after `lobbies.removePlayerFromLobby`, emit `playerDisconnected` and broadcast when lobby survives.
- All three call sites invoke the helper instead of inline duplicated `if (result && !result.deleted) { withLobbyContext … isPlayingPhase … }` blocks.
- `broadcastLobbyList()` call ordering and `socket.leave(lobby.id)` behavior in `leaveLobbyForSocket` are unchanged.
- `cd game && pnpm test:quick` passes (including `leaveLobby` integration and disconnect/eviction coverage).

## Technical Specs

- **Edit:** `game/server/index.js`
  - Add `function notifyPlayerRemoved(lobby, { playerId, result, emitDisconnect = false })` (or similar signature) near the other lobby leave helpers (~L970–1070).
  - Helper body should:
    - Optionally `io.to(lobby.id).emit('playerDisconnected', playerId)` when `emitDisconnect` is true.
    - When `result && !result.deleted`, run `withLobbyContext(lobby, () => { isPlayingPhase ? checkRunTerminalState() : broadcastLobbyUpdate(lobby) })`.
  - Replace duplicated blocks in:
    - `softDisconnectPlayerFromLobby` (~L994–998) — `emitDisconnect: false`, pass through existing context (may not have a `result` from `removePlayerFromLobby`; helper should support the soft-disconnect case without requiring removal result).
    - `evictDisconnectedPlayers` (~L1024–1034) — `emitDisconnect: true`, pass `result` from `removePlayerFromLobby`.
    - `leaveLobbyForSocket` (~L1056–1066) — `emitDisconnect: true`, pass `result` from `removePlayerFromLobby`.
  - Keep `savePlayerData` / `cancelTradesForPlayer` / `socket.leave` / `broadcastLobbyList` at each call site; only dedupe the shared broadcast tail.
- Do not change handler module layout or client event names.

## Verification: code
