# Migrate client to authenticate socket connections via session cookie

Update the client's `createSocket()` in `game/client/main.js` to stop passing a JWT token in the Socket.IO `auth` object. The browser will automatically send the session cookie on same-origin WebSocket upgrades, so the server middleware can authenticate via the cookie instead.

Also update the `connect_error` handler in `connectionHandlers.js` to recognize session-related error messages (not just JWT/token errors) as auth failures that should show the login overlay.

## Acceptance Criteria

- `createSocket()` no longer passes `auth: { token }` in the Socket.IO configuration
- `createSocket()` still accepts a `token` parameter for backward compatibility (callers pass it; it is simply not used for socket auth)
- The `connect_error` handler in `connectionHandlers.js` recognizes error messages containing "session" as auth errors (in addition to existing "jwt|token|unauthorized|authentication")
- Existing callers of `createSocket(token)` continue to work without code changes (restoreSession, requestJoinLobby, handleLobbyDeepLinkAfterInit, login handler)
- The `getSocketAuthToken()` function and its callers in `requestJoinLobby` / `handleLobbyDeepLinkAfterInit` are unchanged (they guard the lobby-join flow, not the socket creation)
- All existing client tests still pass

## Technical Specs

- **File**: `game/client/main.js` — modify `createSocket()` (~line 1204–1235): remove `auth: { token }` from `ioConfig`
- **File**: `game/client/socketHandlers/connectionHandlers.js` — modify `connect_error` handler (~line 40): update regex from `/jwt|token|unauthorized|authentication/i` to `/jwt|token|session|unauthorized|authentication/i`
- Do NOT change `restoreSession()`, `requestJoinLobby()`, `handleLobbyDeepLinkAfterInit()`, or the login/register handlers — they still obtain and store the JWT token for HTTP API calls; the token is just no longer needed for socket auth
- Do NOT change the fly replay client (`game/client/fly_replay_client.js`) — it is a separate concern

## Verification: code
