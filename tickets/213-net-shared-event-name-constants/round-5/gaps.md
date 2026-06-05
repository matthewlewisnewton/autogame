1. The drift guard ignores dynamic server emit expressions, so it does not prove every server-emit name resolves through the shared registry.
   Files: game/server/test/event_name_drift.test.js, game/server/progression.js, game/server/index.js, game/server/socketHandlers/lobbyHandlers.js
   Fix: Update the scanner to inspect dynamic first-argument expressions and dynamic `event` sources for raw string literals and `EVENTS.<name>` references, then add failure-mode tests for the runComplete/runFailed ternary and `phaseMismatch: { event: EVENTS.<name> }` paths.
