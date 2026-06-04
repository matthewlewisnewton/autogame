# Expand card_sync.test.js to diff full stat objects

The current `card_sync.test.js` only guards id/name/type/charges/acquisition/
rewardOrder, which is why the stat and sell-value drift shipped silently.
Expand it to diff the full shared stat surface plus sell values and evolution
transforms, so future drift fails CI.

## Acceptance Criteria

- `server/test/card_sync.test.js` gains a check that, for every card id, the
  stat fields shared between server `CARD_DEFS` and client `CARD_DEFS` are equal
  (compare the full client stat object against the corresponding server fields;
  server-only computed-overlay fields such as the `Math.PI`/`TICK_RATE` ones may
  be excluded explicitly).
- The test asserts client and server `CARD_SELL_VALUES` are deeply equal and
  client/server `EVOLUTION_TRANSFORMS` are deeply equal.
- The test asserts `getCardSellValue` returns the same value on both sides for
  every card id in `CARD_DEFS` (covers the computed-fallback path too).
- The new assertions PASS against the post-01/02/03 code (proving the sources
  are genuinely unified), and the file's existing id/name/type/charges and
  starting-deck checks still pass.
- `cd game && pnpm test` passes.

## Technical Specs

- File: `game/server/test/card_sync.test.js`.
- Import `CARD_SELL_VALUES` / `EVOLUTION_TRANSFORMS` / `getCardSellValue` from
  both `../index.js` (server) and `../../client/cards.js` (client), mirroring the
  existing `CARD_DEFS` dual import.
- For the stat diff, iterate client card keys and assert each client field
  matches the server `CARD_DEFS[key]` field; if a small allow-list of
  server-only overlay keys is needed, define it explicitly and document why.
- Do not weaken or remove the existing assertions.

## Verification: code
