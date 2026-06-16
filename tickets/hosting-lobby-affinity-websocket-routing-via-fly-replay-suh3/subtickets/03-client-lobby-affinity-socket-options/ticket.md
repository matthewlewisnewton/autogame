# Client lobby-affinity Socket.IO options and join-by-code

Teach the browser client to target the owning Fly machine when joining a remote lobby or entering via a share link. Lobby summaries already include `instanceId` from the global browser; the client must pass that id on the Socket.IO handshake so the server hook can route (or skip replay when already local).

## Acceptance Criteria

- `createSocket(token, options?)` in `game/client/main.js` accepts optional `{ lobbyId, flyInstanceId }` and passes them on the Socket.IO client:
  - `query`: includes `lobbyId` (canonical key used by server hook) and a fly target field (e.g. `fly_instance_id`) when `flyInstanceId` is set
  - `extraHeaders`: includes `fly-force-instance-id: <flyInstanceId>` when set (helps polling requests avoid an extra replay hop)
- Joining from the lobby browser: before `joinLobby`, if the selected summary has `instanceId` different from the last connected instance (or always when present), reconnect the socket with that `flyInstanceId` and the target `lobbyId`, then emit `joinLobby` after `connect`
- **Join-by-code:** when `window.location.search` contains `?lobby=<id>` (8-char lobby id), after `init` resolves the lobby in `data.lobbies` (match by `id`), auto-route the socket to that lobby's `instanceId` and emit `joinLobby` (same as clicking Join on that row)
- Creating a lobby does not force a remote instance id (defaults to current machine)
- Reconnect after auth (`restoreSession`) keeps prior behavior when no lobby target is pending
- `game/client/test/fly_replay_client.test.js` (or extend `main.test.js`) asserts `io()` is called with the expected `query` / `extraHeaders` when joining a remote summary and for `?lobby=` deep links
- With no `instanceId` on summaries (local dev), client omits fly headers/query extras — no regression in default dev flow

## Technical Specs

- **File:** `game/client/main.js`
  - Refactor `createSocket` to forward affinity options to `io({ … })`
  - Track `pendingLobbyJoin: { lobbyId, instanceId } | null` set by lobby-browser click handler and join-by-code bootstrap
  - On `connect`, if `pendingLobbyJoin` set, emit `CLIENT_TO_SERVER.JOIN_LOBBY` once then clear pending state
  - Parse `?lobby=` early (near existing `URLSearchParams` debug/booth parsing) and stash pending join before/at first `init`
- **File:** `game/client/main.js` lobby list click handler (~`JOIN_LOBBY` emit): read `lobby.instanceId` from list row data; call `createSocket(currentToken, { lobbyId: lobby.id, flyInstanceId: lobby.instanceId })` when needed instead of bare `joinLobby` on a mismatched socket
- **File:** `game/client/socketHandlers/lobbyBrowserHandlers.js` (if join UI lives here) — same affinity wiring if handlers were extracted
- **New/extended test:** `game/client/test/fly_replay_client.test.js`
  - Mock `socket.io-client` `io` spy; feed fake `init.lobbies` with two `instanceId` values
- **Dependency:** sub-ticket `02-server-fly-replay-handshake-hook` (server must read the query keys this ticket sends)

## Verification: code
