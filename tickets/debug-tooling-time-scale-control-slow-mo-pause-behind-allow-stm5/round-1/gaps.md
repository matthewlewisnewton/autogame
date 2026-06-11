1. `SET_DEBUG_TIME_SCALE` and Shift+T are enabled on localhost even when `ALLOW_DEBUG_SCENARIOS` is unset, violating the required env-flag gate.
   Files: `game/server/socketHandlers/lobbyHandlers.js`, `game/server/index.js`, `game/client/main.js`
   Fix: Gate this feature on `process.env.ALLOW_DEBUG_SCENARIOS === '1'` specifically, make the client keybind inert unless the server/env-authorized debug flag is active, and add socket/client coverage for the env-unset rejection path.
