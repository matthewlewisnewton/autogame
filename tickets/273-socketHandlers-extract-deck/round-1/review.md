# Senior Review: 273-socketHandlers-extract-deck

## Runtime Health

PASS. The captured run in `metrics.json` reports `ok: true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains no `pageerror` or `[fatal]` entries from game code; the only browser console errors are 409 registration conflicts during harness setup, and the server/client logs show the game starting, two players connecting, entering play, moving, and exercising the dodge cooldown path. Vite `EPIPE` socket-close noise is present in `client.log` and is benign per the review instructions.

The metrics reference four screenshots, but no PNG files are present in the round folder. The structured probes still confirm the expected live state: connected multiplayer session, lobby-to-playing transition, canvas initialized, hand visible, movement applied, and key-item cooldown displayed.

## Acceptance Criteria

PASS. The deck-related socket handlers have been moved into `game/server/socketHandlers/deckHandlers.js` and are registered from `game/server/socketHandlers/lobbyHandlers.js` via `deckHandlers.register(socket, ctx)`. The extracted module includes the deck edit, ready/deck validation, inventory/shop, grind/evolution, and trade handlers that were removed from `lobbyHandlers.js`.

The registration context preserves the required dependencies: `withLobbyPlayer`, `broadcastLobbyUpdate`, and `findSocketByPlayerId` are supplied by `index.js`, so trade notifications, ready state broadcasts, and lobby-phase checks still use the existing live server helpers. Search confirmed there are no duplicate remaining definitions for these socket events in `lobbyHandlers.js`.

Behavior appears preserved. The extracted code continues to enforce lobby-only deck/shop/trade operations, normalizes inventory before deck mutations, validates selected decks before readying, persists successful deck/inventory/trade changes, and leaves run-lifecycle/gameplay handlers in `lobbyHandlers.js`.

Tests are green. I ran `pnpm test:quick` from `game/`; it passed with 91 test files and 1,837 tests.

## Design And Requirements

PASS. The change is a server-side organization refactor and does not alter the documented core loop, card combat model, lobby flow, dungeon entry, rendering, websocket connectivity, multiplayer visualization, or WASD movement synchronization. The captured run also exercises the lobby browser/squad flow through gameplay without regressions.

## Debug Scenarios

PASS. This ticket did not add or change any `?debugScenario=...` shortcut. The capture used the fallback smoke path with `debugScenario: null`, so normal gameplay remains the exercised path.

## Code Quality

PASS. The new module keeps deck/shop/trade concerns out of the larger lobby handler file without adding circular imports. `git diff --check` reported no whitespace errors. I did not find dead duplicate handler registrations, missing exports, missing context wiring, or runtime console failures attributable to the ticket.

## Remaining gaps

None.

VERDICT: PASS
