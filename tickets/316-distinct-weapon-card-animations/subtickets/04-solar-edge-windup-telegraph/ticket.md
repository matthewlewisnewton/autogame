# Solar Edge wind-up charge telegraph

Solar Edge (`flame_blade`) already has a distinct fiery slash visual but is named
in the top-level ticket as a heavy wind-up weapon, yet its live stats are only
`{ "damage": 28 }` — so it never enters the server wind-up state and the existing
315 charge-up telegraph never plays before its swing. Give `flame_blade` a
positive `windUpMs` so the telegraph fires, and extend the test that documents
the wind-up → telegraph link to cover it.

## Acceptance Criteria
- `flame_blade` (Solar Edge) carries a positive `windUpMs` in the merged card
  stats the client uses, so the existing server wind-up lockout and the 315
  client charge-up telegraph (rendered automatically in `renderer.js` from
  server `cardWindupUntil` state) fire before its swing.
- The `windUpMs` value is in the same heavy-hitter range as the other wind-up
  weapons (the greatswords use 600–800 ms; `flame_blade` should be a comparable
  positive value, e.g. ~500–700 ms — a deliberate, committed hit).
- A test asserts `flame_blade` has `windUpMs > 0` via the same client card-def
  accessor (`CARD_DEFS` / `getCardDef`) used by the existing greatsword wind-up
  test. Prefer extending the existing
  `each greatsword carries a positive windUpMs ...` test (or adding a sibling
  test) so the wind-up coverage set includes `flame_blade`.
- Solar Edge's existing distinct slash/trail visual and its renderer registration
  are unchanged; no other weapon's stats or renderers are altered.
- Existing client + server vitest suites still pass.

## Technical Specs
- `game/shared/cardStats.json`:
  - Change the `flame_blade` entry from `{ "damage": 28 }` to add a `"windUpMs"`
    field, e.g. `{ "damage": 28, "windUpMs": 600 }`. Keep the existing `damage`
    value and JSON formatting/comma placement consistent with neighboring
    entries.
- `game/client/test/cardRenderers.test.js`:
  - Extend the existing wind-up assertion (around the
    `each greatsword carries a positive windUpMs so the 315 charge telegraph
    fires` test, ~line 743) to also cover `flame_blade`, or add a small sibling
    test asserting `CARD_DEFS['flame_blade'].windUpMs > 0`. Use the same card-def
    accessor/import already present in that file.

## Verification: code
