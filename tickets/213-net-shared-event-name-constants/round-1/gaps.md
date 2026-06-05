1. Raw gameplay event names remain in server dynamic emit paths (`'questUpdate'`, `'keyItemError'`, `'medicError'`), so the registry is not canonical.
   Files: game/server/index.js, game/server/socketHandlers/keyItemHandlers.js, game/server/socketHandlers/lobbyHandlers.js
   Fix: Replace these raw event values with `EVENTS.questUpdate`, `EVENTS.keyItemError`, and `EVENTS.medicError`; make helper params/constants preserve registry references.

2. Client socket listener helpers still use raw gameplay event names with `.once`/`.off`, so listener names can drift from `events.json`.
   Files: game/client/main.js
   Fix: Replace raw `debugScenarioResult`, `deckUpdate`, `deckError`, `cardEvolutionResult`, and `cardEvolutionError` listener names with the matching `EVENTS.*` constants.

3. The drift-guard test passes while the raw event names above remain because it scans only `.emit`/`.on` and ignores dynamic event arguments.
   Files: game/server/test/event_name_drift.test.js
   Fix: Extend the guard to cover `.once`/`.off` listener APIs and catch raw event literals that feed dynamic emit helpers/defaults such as `event = 'questUpdate'` and `phaseMismatch.event`.
