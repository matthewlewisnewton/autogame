# Expand card_sync test to diff full stat objects

Strengthen `server/test/card_sync.test.js` so it diffs the FULL shared stat
objects between server and client (not just id/name/type/charges) and guards the
shared sell-value and evolution-transform maps, so the drift that shipped
silently can never recur.

## Acceptance Criteria

- For every card id, the test asserts that every *shared* field present on the
  client `CARD_DEFS[id]` has an equal value on the server `CARD_DEFS[id]`
  (deep-equal per field), in addition to the existing id/name/type/charges
  check. Server-only overlay fields are allowed to exist only on the server.
- The test asserts `CARD_SELL_VALUES` is identical between server and client
  (same keys, same numbers) — this would FAIL against the pre-refactor code
  (server had `aegis_sentinel`, client had `arcane_bolt`).
- The test asserts `EVOLUTION_TRANSFORMS` is identical between server and client.
- The existing "same card ids on both sides" and starting-deck sync tests are
  retained and still pass.
- `cd game && pnpm test` passes with the expanded assertions.

## Technical Specs

- `game/server/test/card_sync.test.js` — import `CARD_SELL_VALUES` and
  `EVOLUTION_TRANSFORMS` from both `../index.js` (server) and
  `../../client/cards.js` (client). Add a per-card loop that compares each shared
  field, and `expect(...).toEqual(...)` assertions for the two maps. Keep the
  existing `describe` blocks.
- No changes to game source under `game/server/` or `game/client/` outside the
  test file; this sub-ticket only edits the test.

## Verification: code
