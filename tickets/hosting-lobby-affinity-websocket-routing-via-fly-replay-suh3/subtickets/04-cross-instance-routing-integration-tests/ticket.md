# Cross-instance lobby routing integration tests

Add focused server tests that prove lobby creation records ownership and that a connection arriving on the wrong machine is replayed to the owner, while single-instance mode stays unchanged. This sub-ticket closes the parent acceptance criteria without requiring live Fly.io or Redis.

## Acceptance Criteria

- `createLobby()` with Redis enabled + `FLY_MACHINE_ID` set registers `getLobbyOwner(lobby.id) === getFlyMachineId()` (extends or complements `lobby_registry.test.js`)
- Integration test simulates two machines (`FLY_MACHINE_ID=machine-a` vs `machine-b`) sharing the in-memory Redis shim:
  - Register lobby on A → owner is `machine-a`
  - Handshake to B with `lobbyId` query for that lobby → HTTP response includes `fly-replay: instance=machine-a`
  - Handshake to A with same query → no `fly-replay` header; Socket.IO connect succeeds
- Self-owned lobby on A with query for that lobby → no replay header
- With `REDIS_URL` unset (and no test force-enable), attach hook + `resolveLobbyRouting` never replay; existing lobby integration tests unchanged
- All harness checks pass: `cd game && pnpm test:quick` (or project-standard quick server+client vitest command)

## Technical Specs

- **New file:** `game/server/test/fly_replay_integration.test.js`
  - Use `enableRedisForTests()`, `resetLobbyRegistryForTests()`, `resetRedisForTests()` from existing redis/registry test helpers
  - Spin up `startServer(0)` twice sequentially with different `process.env.FLY_MACHINE_ID` **or** test hook layer with injected `resolveLobbyRouting` + real hook (prefer one shared Redis shim, two routing contexts)
  - Raw `http.get` / `net.connect` upgrade request to `/socket.io/?…&lobbyId=<id>&transport=websocket` asserting response headers
  - JWT optional for hook-only tests (replay fires before Socket.IO auth); document if test uses minimal handshake without token
- **File:** `game/server/test/lobby_registry.test.js` (optional small addition)
  - One case asserting owner uses `FLY_MACHINE_ID` when set
- **File:** `game/docs/lobbies.md` (optional one paragraph)
  - Document Fly-Replay routing, `instanceId` on lobby summaries, and `?lobby=` join links for operators
- **Dependencies:** sub-tickets `01`, `02`, and `03` (tests assume full stack; client tests from 03 can stay separate — this file is server integration only)

## Verification: code
