# Socket handler scaffold and connection handlers

## Description

Introduce `game/client/socketHandlers/` with a shared context object and extract the connection-lifecycle listeners from `bindSocketHandlers` into `bindConnectionHandlers`. This establishes the registration-group pattern (mirroring server `socketHandlers/*.js`) without changing handler behavior. All other socket listeners remain in `main.js` until later sub-tickets.

## Acceptance Criteria

- `game/client/socketHandlers/socketHandlerCtx.js` exports a factory (e.g. `createSocketHandlerCtx`) that builds a context object with getters/setters for shared mutable state (`myId`, `gameState`, `connectionState`, `latency`, etc.) and references to helpers the connection handlers need (`clearConnectWatchdog`, `startConnectWatchdog`, `startHeartbeat`, `stopHeartbeat`, `updateStatus`, DOM refs, `TOKEN_KEY`, `setAuthToken`, etc.)
- `game/client/socketHandlers/connectionHandlers.js` exports `bindConnectionHandlers(s, ctx)` registering: `connect`, `disconnect`, `connect_error`, and `s.io.on('reconnect_attempt')` / `s.io.on('reconnect')` — moved verbatim from `main.js`
- `bindSocketHandlers` in `main.js` calls `bindConnectionHandlers(s, socketHandlerCtx)` and still registers all remaining listeners inline
- `window.bindSocketHandlers` remains exported from `main.js` and still works when passed `null` (no-op)
- Existing `game/client/test/main.test.js` suites for `bindSocketHandlers`, `connect_error`, and socket recreate pass unchanged

## Technical Specs

- **Add:** `game/client/socketHandlers/socketHandlerCtx.js` — build ctx once in `main.js` after module-scope state/DOM refs are initialized; use getter properties (like `cardRenderCtx.get myId()`) where handlers must read current values
- **Add:** `game/client/socketHandlers/connectionHandlers.js` — `export function bindConnectionHandlers(s, ctx) { ... }`
- **Edit:** `game/client/main.js` — import the new modules; instantiate `const socketHandlerCtx = createSocketHandlerCtx({ ... })`; replace inline connection/`s.io` listeners (lines ~1230–1293) with `bindConnectionHandlers(s, socketHandlerCtx)` call at the top of `bindSocketHandlers`
- **Do not** move any `SERVER_TO_CLIENT.*` handlers in this sub-ticket

## Verification: code
