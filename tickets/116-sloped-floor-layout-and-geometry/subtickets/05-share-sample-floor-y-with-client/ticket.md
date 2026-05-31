# Share sampleFloorY with Client

Move `sampleFloorY` from the server-only `game/server/dungeon.js` into the shared `game/client/collision.js` module so both client and server can use the same floor-height sampler. The server re-exports it from `dungeon.js` to preserve existing import paths.

## Acceptance Criteria

- `sampleFloorY(layout, x, z)` is defined and exported from `game/client/collision.js`.
- `game/server/dungeon.js` imports `sampleFloorY` from `../client/collision.js` (or a shared re-export path) and re-exports it, preserving the existing `import { sampleFloorY } from '../dungeon.js'` path used by server tests.
- All existing server tests in `game/server/test/dungeon.test.js` that import `sampleFloorY` continue to pass without modification.
- The client can import `sampleFloorY` from `./collision.js` (verified by a client-side test or an import in `game/client/dungeon.js`).
- A client-side test in `game/client/test/collision-hand.test.js` (or a new `game/client/test/floor-sampler.test.js`) verifies `sampleFloorY` on both a flat room and a sloped room.

## Technical Specs

- **File:** `game/client/collision.js` — add `sampleFloorY(layout, x, z)` function (copy from `game/server/dungeon.js`). Also export `DEFAULT_FLOOR_Y = 0..5` constant used by the sampler.
- **File:** `game/server/dungeon.js` — remove the local `sampleFloorY` definition; import it from `../client/collision.js` and re-export in `module.exports`. Keep `DEFAULT_FLOOR_Y` import as well.
- **File:** `game/server/test/dungeon.test.js` — no change needed (imports from `../dungeon.js` which re-exports).
- **File:** `game/client/test/collision-hand.test.js` — add tests for `sampleFloorY` on flat and sloped fixtures (mirrors server test coverage).

## Verification: code
