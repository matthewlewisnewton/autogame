## Runtime health

`metrics.json` reports `ok: true`, a successful fallback smoke capture, connected gameplay state, canvas presence, two players, lobby-to-run transition, movement, and dodge cooldown HUD probes. `pageerrors` is empty and `pageerrors.json` is `[]`. `console.log` contains only Vite connection lines plus 409 resource responses, with no `pageerror` or `[fatal]` entries from game code. `server.log` has no error/fatal/exception matches; `client.log` only contains benign Vite websocket proxy `ECONNRESET` noise during shutdown. The game starts and loads cleanly.

The screenshot files referenced by `metrics.json` are not present in the round directory, but the structured capture probes and logs provide runnable proof for this event-registry ticket.

## Acceptance criteria

1. Add shared canonical event names and import on both sides: satisfied. `game/shared/events.json` defines the canonical `serverToClient` and `clientToServer` wire strings, with `game/shared/events.js` exposing CommonJS aliases for server code. Browser modules import the same JSON catalog directly, while server modules import `SERVER_TO_CLIENT` / `CLIENT_TO_SERVER` from the shared module.

2. Replace literals incrementally: satisfied. The changed live code routes production server emits/listeners and client listeners/emits through the shared constants across `game/server/index.js`, `game/server/progression.js`, `game/server/cardEffects.js`, `game/server/keyItemEffects.js`, `game/server/debugScenarios.js`, `game/server/hubPresence.js`, `game/server/socketHandlers/*.js`, `game/client/main.js`, `game/client/renderer.js`, and `game/client/characterBooth.js`. Critical dynamic paths such as run completion/failure now select between `SERVER_TO_CLIENT.RUN_COMPLETE` and `SERVER_TO_CLIENT.RUN_FAILED`, preserving the existing wire protocol.

3. Add a drift guard test: satisfied. `game/server/test/events.test.js` validates the registry shape and critical pairs, and `game/server/test/socket_events_drift.test.js` scans production server/client socket paths for uncatalogued literal Socket.IO events, including `socket.on`, `socket.emit`, `s.on`, `socket.once`, `socket.off`, and `socketRef.emit`. Coverage log shows both new tests ran, with the full server suite passing: 91 test files and 1420 tests.

## Design and requirements fit

The change is infrastructure-only for Socket.IO event naming and does not alter the documented lobby, dungeon, combat, loot, movement, or multiplayer foundations. The captured run still demonstrates login/lobby, ready transition, WebSocket connectivity, 3D rendering, movement, replicated gameplay state, and key-item HUD behavior, so the foundation in `game/docs/requirements.md` remains intact.

## Code quality

The implementation is appropriately mechanical and conservative. The shared catalog keeps existing wire strings stable, avoids protocol renames, and the server/client import choices match their module systems. I did not find dead or broken production socket code, missing catalog entries for changed production call sites, or runtime console defects. `git diff --check` is clean.

## Debug scenarios

No new development debug scenario was introduced. Existing debug scenario event names were converted to shared constants only; the URL/query-param gated debug path and server-side `allowDebugScenario` checks remain in place.

## Remaining gaps

None.

VERDICT: PASS
