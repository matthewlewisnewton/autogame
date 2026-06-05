# 06 — Client `socket.once` / `socket.off` use shared constants

Round-1 left raw wire strings in the test/Playwright hooks that listen for one-shot server replies. Those listeners are real client subscriptions to catalogued `serverToClient` events; they must use `SERVER_TO_CLIENT.*` so renames cannot silently break deck, evolution, or debug-scenario test helpers.

## Acceptance Criteria

- In `game/client/main.js`, every `socket.once(` and `socket.off(` first argument for custom game events uses `SERVER_TO_CLIENT.*` (not a string literal).
- Covered call sites: `window.__requestDebugScenarioForTest` (`debugScenarioResult`), `window.__configureDeckForTest` (`deckUpdate`, `deckError`), and `window.__evolveCardForTest` (`cardEvolutionResult`, `cardEvolutionError`).
- Socket.IO transport built-ins (`connect`, `disconnect`, `connect_error`) remain literal strings if present.
- No custom event string literals remain in `socket.once(` / `socket.off(` first arguments anywhere in `main.js`.
- Handler logic, timeouts, and payloads are unchanged.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **Edit:** `game/client/main.js` only.
- Reuse the existing import/destructure of `SERVER_TO_CLIENT` from `game/shared/events.json` (already at top of file).
- Map literals to catalog keys: `DEBUG_SCENARIO_RESULT`, `DECK_UPDATE`, `DECK_ERROR`, `CARD_EVOLUTION_RESULT`, `CARD_EVOLUTION_ERROR`.
- Do not add new catalog entries; do not change `game/shared/events.json`.
- Do not modify passed sub-tickets 01–05, harness files, or review artifacts.

## Verification: code
