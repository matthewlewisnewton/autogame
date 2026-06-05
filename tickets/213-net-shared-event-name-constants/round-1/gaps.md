1. Client-side server-event listeners still use raw wire strings, and the drift guard does not scan them.
   Files: game/client/main.js, game/server/test/socket_events_drift.test.js
   Fix: Replace `socket.once(...)`/`socket.off(...)` listener strings for `debugScenarioResult`, `deckUpdate`, `deckError`, `cardEvolutionResult`, and `cardEvolutionError` with `SERVER_TO_CLIENT.*` constants, then extend the drift test to catch client `socket.once(...)` and relevant listener cleanup strings.
