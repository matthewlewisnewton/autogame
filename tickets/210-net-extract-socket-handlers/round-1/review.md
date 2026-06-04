# Review: 210-net-extract-socket-handlers

## Runtime health

PASS. The captured game run starts and loads cleanly. `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains Vite connection messages and 409 resource lines, but no `pageerror` or `[fatal]` entries from game code. The server log shows two authenticated socket connections, lobby/run setup, and clean disconnects. The fallback capture exercised auth, lobby create/join, ready transition, movement, and key-item cooldown HUD.

## Acceptance Criteria

1. Move per-event handlers into `game/server/socketHandlers/*` modules exporting `register(socket, ctx)`.

PASS. The live code now has focused registration modules for lifecycle, lobby, run, deck/economy, trade, key item, and debug events. Each event module exports `register(socket, ctx)`, and the large inline connection body has been replaced by context construction plus calls to those registers.

2. Connection handler shrinks to building `ctx` and calling each register.

PASS. `game/server/index.js` now keeps authentication, stable player/session setup, context construction, handler registration, resume handling, and `init` emit in the connection path. The previous large inline socket event body is removed, substantially reducing the merge-conflict surface while preserving startup/reconnect flow.

3. Delete dead `buyShopCard` and `listKeyItems` socket handlers, and extract `notifyPlayerRemoved()`.

PASS. There are no remaining client emitters or socket listeners for `buyShopCard` or `listKeyItems`. The remaining `buyShopCard` symbol is the progression helper, still covered by lower-level unit tests, not the removed socket event. Key-item UI now receives definitions through the existing `init` payload. The duplicated player-removal broadcast/update blocks are consolidated through `socketHandlers/helpers.notifyPlayerRemoved()`.

4. Behavior-preserving with server tests green.

PASS. The committed coverage log reports `40` test files and `924` tests passing. The changed tests remove only the deleted dead socket-event coverage; lower-level shop helper tests remain. The smoke capture confirms the main multiplayer loop still reaches gameplay, moves, and uses a key item without page errors.

## Design and Requirements

PASS. This is an internal server-architecture refactor and does not alter the documented PSO-style lobby/dungeon/card-combat loop in `game/docs/design.md`. The foundation requirements remain intact: the captured run renders a scene, connects frontend to backend via WebSockets, visualizes multiplayer state, and updates movement through server-backed socket events.

## Debug Scenarios

PASS. This ticket moved the existing `debugScenario` handler into `game/server/socketHandlers/debug.js` but did not add a new scenario or introduce a new shortcut path. The moved handler preserves the existing `isDebugScenarioAllowed()` gate, and the capture used normal gameplay with `debugScenario: null`.

## Code Quality

PASS. The new modules are thin, dependency-injected socket registration layers and continue delegating domain logic to the existing progression, card-effect, key-item, lobby, and debug helpers. I did not find broken exports, lost helper captures, duplicate connection-handler registration, or a client/server event mismatch. Coverage visibility for changed files is adequate for a move-only refactor; the smoke run covers the highest-risk integration path.

## Remaining gaps

None.

VERDICT: PASS
