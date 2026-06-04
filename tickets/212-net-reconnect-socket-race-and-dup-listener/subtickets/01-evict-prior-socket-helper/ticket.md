# Evict prior socket before assigning playerId

Fix the reconnect race where `findSocketByPlayerId` can return the newly connecting socket because `socket.playerId` is assigned before the resume/reconnect eviction logic runs, leaving a stale socket connected and receiving duplicate `stateUpdate` events.

## Acceptance Criteria

- `findSocketByPlayerId(playerId, excludeSocketId?)` skips the socket whose `id` equals `excludeSocketId` when provided; existing call sites that omit the second arg behave unchanged.
- A single helper (e.g. `evictPriorSocketForPlayer(playerId, currentSocketId)`) finds any other connected socket for that player and calls `disconnect(true)` on it; both the connection-handler resume block (~L1898–1908) and `reconnectPlayerToLobby` delegate to this helper instead of duplicating lookup/disconnect logic.
- In the `io.on('connection')` handler, prior-socket eviction for resume/reconnect runs **before** `socket.playerId = playerId` is assigned (use the local `playerId` from `accountId` until eviction completes).
- `reconnectPlayerToLobby` passes the incoming socket's `id` as the exclude id when evicting, so it never disconnects itself.
- Unit tests in `game/server/test/server.test.js` cover `excludeSocketId` (returns the other socket when two share a `playerId`; returns null when only the excluded socket matches).

## Technical Specs

- **File:** `game/server/index.js`
  - Extend `findSocketByPlayerId` (~L524–531) with optional `excludeSocketId`.
  - Add `evictPriorSocketForPlayer(playerId, currentSocketId)` near the lookup helper; it wraps find + conditional `disconnect(true)`.
  - Move `socket.playerId = playerId` (~L1153) to after the resume-block eviction that currently lives at ~L1898–1908; run eviction there using `playerId` and `socket.id` before assignment.
  - Replace inline old-socket lookup/disconnect in `reconnectPlayerToLobby` (~L891–894) with a call to the shared helper.
  - Replace the resume block's duplicate lookup/disconnect (~L1901–1906) with the same helper (or rely on the pre-assignment eviction if consolidated into one path—no duplicated eviction on a single connect).
  - Export the helper if tests need it (optional; unit tests can exercise via `findSocketByPlayerId` alone).
- **File:** `game/server/test/server.test.js`
  - Extend the existing `describe('findSocketByPlayerId')` block (~L1992) with cases for `excludeSocketId`.

## Verification: code
