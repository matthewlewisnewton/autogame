# 02 — Extract lobby browser socket handlers

Move lobby create/join/leave handlers into `lobbyHandlers.js` as `register*(socket, ctx)` functions. Behavior must stay identical to the current `index.js` implementations, including drop-in reconnect on `joinLobby`, duplicate-lobby errors, and session re-registration on `leaveLobby`.

## Acceptance Criteria

- `createLobby`, `joinLobby`, and `leaveLobby` are registered only via `registerLobbyHandlers` (no remaining inline `socket.on` for these events in `index.js`).
- Error paths and emits unchanged (`lobbyError` reasons, `lobbyLeft` payload with `lobbies.listLobbySummaries()`, `joinLobbyWithPhasePolicy` / reconnect branch on `joinLobby`).
- `ctx` exposes everything the handlers closure-captured before: `playerId`, `sessionPlayer`, `lobbies`, `withLobbyContext`, `applyLayoutForQuest`, `ensureShopOffer`, `joinPlayerToLobby`, `joinLobbyWithPhasePolicy`, `reconnectPlayerToLobby`, `leaveLobbyForSocket`, `buildSessionFromPlayer`.
- `cd game && pnpm test:quick` passes (including `server/test/lobbies.test.js` and lobby smoke tests if present).

## Technical Specs

- **Edit:** `game/server/socketHandlers/lobbyHandlers.js` — add `registerCreateLobby`, `registerJoinLobby`, `registerLeaveLobby`; call them from `registerLobbyHandlers`.
- **Edit:** `game/server/index.js` — extend `ctx` with join/leave helpers listed above; delete inline handlers (~1194–1243).
- Handler logic is a straight move: preserve `data && data.name`, `lobbyId` validation, and `leaveLobby` session rebuild using `buildSessionFromPlayer(sessionPlayer)`.

## Verification: code
