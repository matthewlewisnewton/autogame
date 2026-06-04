# Dual-socket race integration test

Add an automated regression test that connects a second socket for the same account while the first is still live and asserts the server evicts the stale socket so only one connection per player remains.

## Acceptance Criteria

- New file `game/server/test/dual_socket_race.test.js` follows the structure of `game/server/test/jwt_recovery.test.js` (vitest, `startTestServer` / `closeTestServer` helpers, JWT via `createTestToken`).
- Test scenario: client A connects with a valid JWT, creates/joins a lobby; client B connects with the **same** JWT while A's transport is still connected; after B receives `init`, exactly one server socket has that `playerId`, and A's socket is no longer connected.
- Test passes via `pnpm test:quick` (or the server vitest target that picks up `game/server/test/*.test.js`).
- Test fails on the pre-fix server (two live sockets for one player) and passes once sub-ticket 01 is implemented.

## Technical Specs

- **File:** `game/server/test/dual_socket_race.test.js` (new)
  - Import `startServer`, `resetGameState`, `io`, `server`, `clearAllTimers`, `getJWTSecret`, `findSocketByPlayerId` from `../index.js`; reuse jwt/sign patterns from `jwt_recovery.test.js`.
  - Helper to count connected sockets for a `playerId` (iterate `io.sockets.sockets`, match `socket.playerId`, filter `socket.connected`).
  - Flow:
    1. Start server on port 0; `createTestToken(accountId)`.
    2. Connect socketA → wait for `init` → emit `createLobby` → wait for `lobbyJoined`.
    3. Connect socketB with same token → wait for `init` (do **not** disconnect A first).
    4. Assert connected-socket count for `accountId` is `1`.
    5. Assert `socketA.connected === false` (evicted) and `socketB.connected === true`.
    6. Clean up both clients and close server in `afterEach`.
- **Dependency:** requires sub-ticket 01 (prior-socket eviction) to pass; do not implement until 01 is merged or `.passed`.

## Verification: code
