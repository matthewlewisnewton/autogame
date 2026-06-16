# Server Fly-Replay handshake hook for Socket.IO

Wire Fly-Replay into the Node HTTP server so Socket.IO polling and WebSocket upgrade requests for a **foreign** lobby are replayed to the owning Fly machine before the socket handshake completes. Self-owned lobbies and disabled routing (no Redis / no `FLY_MACHINE_ID`) must fall through with zero behavior change.

## Acceptance Criteria

- New `game/server/flyReplayHook.js` (or equivalent) exports `attachFlyReplayRouting(httpServer)` called once from `startServer()` in `game/server/index.js`
- When `isFlyReplayEnabled()` is false, `attachFlyReplayRouting` is a no-op (no extra listeners)
- For enabled routing, Socket.IO paths (`/socket.io/` polling + websocket `upgrade`) parse a target lobby id from the request URL query (`lobbyId`, `lobby`, or `joinLobby` aliases — pick one canonical name and accept the others for join-by-code)
- When a lobby id is present:
  - `resolveLobbyRouting(lobbyId)` → `replay` → respond with raw HTTP **`101 Switching Protocols`** and header **`fly-replay: instance=<machineId>`** then end the socket (Replicache / express-socketio-fly-replay pattern)
  - `action: 'self'` with `claimOwner: true` and lobby exists locally (`lobbies.getLobbyById`) → fire-and-forget `registerLobby(lobbyId)` then allow handshake to continue
  - `action: 'self'` otherwise → allow handshake to continue (no `fly-replay` header)
- Requests without a lobby id (normal browser login / lobby browse) are not replayed
- `game/server/test/fly_replay_hook.test.js` uses a real `http.Server` + raw upgrade/polling requests with mocked `resolveLobbyRouting` to assert replay header vs pass-through
- Existing websocket auth tests (`websocket_jwt_auth.test.js`) and integration lobby tests pass unchanged with routing disabled

## Technical Specs

- **New file:** `game/server/flyReplayHook.js`
  - `attachFlyReplayRouting(server)` registers:
    - `server.on('upgrade', …)` for websocket upgrades where `req.url` matches `/socket.io/`
    - Early Express middleware (before Socket.IO) for long-polling GET/POST under `/socket.io/` when upgrade path is insufficient
  - Helper `parseLobbyIdFromUrl(url)` extracts lobby id from query string
  - Helper `sendFlyReplayResponse(rawSocket, machineId)` writes the `101` + `fly-replay` raw response
  - Import `resolveLobbyRouting`, `isFlyReplayEnabled` from `./flyReplay.js`; import `registerLobby` from `./lobbyRegistry.js`; import `lobbies.getLobbyById` from `./lobbies.js`
- **File:** `game/server/index.js`
  - After `const server = http.createServer(app)` / inside `startServer()`, call `attachFlyReplayRouting(server)` once (guard against test double-mount like `_routesMounted`)
- **New file:** `game/server/test/fly_replay_hook.test.js`
  - Simulate wrong-machine arrival: routing returns `replay` → response includes `fly-replay: instance=…`
  - Same machine → Socket.IO handler still reachable (no replay header)
- **Dependency:** sub-ticket `01-fly-machine-id-and-routing-helpers` (uses `flyReplay.js`)

## Verification: code
