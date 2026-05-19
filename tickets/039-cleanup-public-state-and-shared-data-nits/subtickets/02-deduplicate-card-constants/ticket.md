# Deduplicate card and deck constants shared by server and client

Card definitions (`CARD_DEFS`) and starting deck composition (`STARTING_DECK_IDS` / `createStartingDeck()`) are mirrored in `game/server/index.js` and `game/client/cards.js`. The server copy includes a `damage` field the client doesn't need; the client copy has `magicStoneCost` the server reads. Drift risk grows as new cards or deck rules are added.

Add a small sync-verification test that asserts the two copies stay in step, or move to a shared source.

## Acceptance Criteria

- A test exists that verifies the server's `CARD_DEFS` and the client's `CARD_DEFS` have the same keys and matching `id`, `name`, `type`, `charges` values.
- The test also verifies `STARTING_DECK_IDS` (server) and `createStartingDeck()` (client) return the same card ids in the same order.
- Current card ids, names, types, charges, costs, and server damage values are preserved — no behavior change.
- `npm test -- --coverage.enabled=false` passes.

## Technical Specs

- **File**: `game/server/index.js` (lines ~134–152) — server-side `CARD_DEFS` and `STARTING_DECK_IDS`.
- **File**: `game/client/cards.js` — client-side `CARD_DEFS` and `createStartingDeck()`.
- **New file**: `game/server/test/card_sync.test.js` (or add to existing `server.test.js`) — import both modules and assert card ids, names, types, charges match; assert starting deck compositions match. Note: the server file is CommonJS (`require`), the client is ESM (`export`) — the test may need to import the client file via its Vite-built output or use dynamic `import()`.

## Verification: code
