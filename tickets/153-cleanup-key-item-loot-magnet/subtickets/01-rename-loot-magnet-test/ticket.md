# Rename loot magnet “moves closer” test to match snap-and-collect behavior

The first case in `loot_magnet.test.js` is titled as if it only checks displacement, but at 6m within `attractRadius` the server pulls loot all the way to the player and auto-collects. Rename the test (and tighten comments) so future editors are not misled; the wall-blocked case already covers partial pull without collection.

## Acceptance Criteria

- The first `it(...)` in `game/server/test/loot_magnet.test.js` has a title that states pull **and** auto-collection (or equivalent), not merely “moves closer.”
- Inline comments above that test describe the 6m → full pull → within `LOOT_PICKUP_RADIUS` → collected chain of events.
- Test assertions are unchanged (same `pulled`/`collected` expectations and loot removal checks).
- No new test cases are added unless intentionally scoped as a separate partial-distance / open-LOS case (not required for this sub-ticket).
- `pnpm test:quick` (or the loot-magnet vitest file) still passes.

## Technical Specs

- **`game/server/test/loot_magnet.test.js`**
  - Rename the first test (currently `'loot within attractRadius moves closer to player after useKeyItem'`).
  - Suggested title direction: loot at 6m within `attractRadius` (8m) is pulled to the player and auto-collected.
  - Update the block comment (lines ~60–62) to mention instant full pull and pickup-radius collection explicitly; note that partial pull without collect is covered by the wall test later in the file.
- **Do not change** `game/server/index.js`, `game/server/progression.js`, or client code.

## Verification: code
