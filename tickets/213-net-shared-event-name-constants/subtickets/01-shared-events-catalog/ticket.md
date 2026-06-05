# 01 — Shared socket event name catalog

Add a single canonical registry of game Socket.IO event names under `game/shared/` so server and client can import the same strings. Audit every `socket.on` in `game/server/socketHandlers/` and every production `.emit` / client `s.on` / `socket.emit` in the top-level ticket scope; record them in the catalog (exclude Socket.IO built-ins: `connect`, `disconnect`, `connect_error`).

## Acceptance Criteria

- `game/shared/events.json` exists with two top-level objects: `serverToClient` and `clientToServer`, each mapping `SCREAMING_SNAKE` keys to the exact wire string (e.g. `"RUN_COMPLETE": "runComplete"`).
- The catalog includes every custom event currently used in production server handlers and emits (including `runComplete` / `runFailed` used by the ternary at `progression.js` ~2859) and every custom event in `game/client/main.js` `s.on` / `socket.emit`.
- `game/shared/events.js` exports the same values for server `require()` (follow the `floorSampling.js` / JSON `require` pattern used elsewhere under `shared/`).
- `game/client/` can import the registry (JSON `import … with { type: 'json' }` or ESM re-export) without duplicating strings.
- `game/server/test/events.test.js` (or `game/client/test/events.test.js`) asserts both maps are non-empty, values are unique strings, and spot-checks critical pairs (`RUN_COMPLETE` → `runComplete`, `STATE_UPDATE` → `stateUpdate`, `MOVE` → `move`).
- No production `.emit` / `socket.on` / `s.on` / `socket.emit` call sites are migrated yet in this sub-ticket.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **New:** `game/shared/events.json` — authoritative list; group ~40 `serverToClient` and ~25 `clientToServer` entries from: `socketHandlers/{lobby,deck,run,trade,keyItem}Handlers.js`, `server/{index,progression,cardEffects,keyItemEffects,debugScenarios,hubPresence}.js`, `client/main.js`.
- **New:** `game/shared/events.js` — `module.exports = { SERVER_TO_CLIENT, CLIENT_TO_SERVER, … }` derived from the JSON (or thin constant re-exports).
- **New:** `game/server/test/events.test.js` — registry shape / uniqueness tests only.
- **Do not edit** handler bodies in this sub-ticket.

## Verification: code
