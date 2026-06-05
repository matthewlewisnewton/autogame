1. Production client-to-server emits outside `main.js` still use raw event strings and are not covered by the drift guard.
   Files: `game/client/renderer.js`, `game/client/characterBooth.js`, `game/server/test/socket_events_drift.test.js`, `game/shared/events.json`
   Fix: import/use the shared `CLIENT_TO_SERVER` catalog in those client modules for `MOVE`, `LOOT_PICKUP`, `BOOTH_INTERACT`, `UNLOCK_HAT`, and `APPLY_APPEARANCE_CHANGE`, then extend the drift guard to scan all production client socket emit/listener files, not only `client/main.js`.
