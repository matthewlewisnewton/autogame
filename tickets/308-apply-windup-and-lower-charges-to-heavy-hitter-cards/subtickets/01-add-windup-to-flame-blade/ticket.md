# 01-add-windup-to-flame-blade

Add a `windUpMs` property to Solar Edge (flame_blade) so it commits the player during its wind-up window, matching the pattern already used by magma_greatsword (800 ms) and steel_claymore (600 ms).

## Acceptance Criteria

- `game/shared/cardStats.json` contains `"windUpMs": 600` on the `flame_blade` entry
- Server wind-up lock already handles any card with `windUpMs > 0` (no server code change needed) — verify by reading `card_windup_lock.test.js` and `card_windup_resolution.test.js`
- Add a test in `game/server/test/` (or update an existing wind-up test) asserting that `flame_blade` has a `windUpMs` value and triggers wind-up lock when played
- Add a test in `game/client/test/cards.test.js` asserting `CARD_DEFS.flame_blade.windUpMs === 600`
- All existing tests still pass (`pnpm test`)

## Technical Specs

- **game/shared/cardStats.json** — add `"windUpMs": 600` to the `flame_blade` object (place alongside existing `damage` field)
- **game/server/test/card_windup_resolution.test.js** — add a test case using `flame_blade` (analogous to the existing `magma_greatsword` test at line 112) to verify wind-up → resolve flow
- **game/client/test/cards.test.js** — update the `flame_blade` test (line 30) to also assert `windUpMs: 600`

## Verification: code
