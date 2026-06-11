# Init and lobby-browser socket handlers

## Description

Extract session bootstrap and lobby-browser socket listeners from `bindSocketHandlers` into dedicated modules. These handlers cover the post-login `init` payload and the lobby list/join/leave flow before a squad is active.

## Acceptance Criteria

- `game/client/socketHandlers/initHandlers.js` exports `bindInitHandlers(s, ctx)` with the `SERVER_TO_CLIENT.INIT` handler moved verbatim from `main.js`
- `game/client/socketHandlers/lobbyBrowserHandlers.js` exports `bindLobbyBrowserHandlers(s, ctx)` with handlers for `LOBBY_JOINED`, `LOBBY_LEFT`, `LOBBY_LIST_UPDATE`, and `LOBBY_ERROR` moved verbatim
- `bindSocketHandlers` delegates to both new bind functions; no duplicate `s.on` registrations remain in `main.js` for these events
- Behavior unchanged: reconnect `init` with `data.inLobby` still early-returns; lobby browser list rendering and error surfacing work as before
- `game/client/test/main.test.js` `bindSocketHandlers` event-listener tests still pass (`init` and lobby-browser events registered on fresh sockets)

## Technical Specs

- **Add:** `game/client/socketHandlers/initHandlers.js`
- **Add:** `game/client/socketHandlers/lobbyBrowserHandlers.js`
- **Edit:** `game/client/socketHandlers/socketHandlerCtx.js` — extend ctx with any deps used by these handlers (`rendererSetMyId`, `renderDeckEditor`, `applyLobbyJoinedData`, `showLobbyBrowser`, `renderLobbyList`, `getBoothDebugHook`, `launchBoothReadyUp`, `STORAGE_KEY_PLAYER_ID`, etc.)
- **Edit:** `game/client/main.js` — import and call `bindInitHandlers` / `bindLobbyBrowserHandlers` from `bindSocketHandlers`; delete the moved inline handler bodies (~lines 1295–1357)

## Verification: code
