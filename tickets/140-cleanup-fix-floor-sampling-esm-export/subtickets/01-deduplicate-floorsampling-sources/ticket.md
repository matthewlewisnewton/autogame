# Deduplicate floorSampling CJS/ESM sources

The CJS file `game/shared/floorSampling.js` and the ESM file `game/shared/floorSampling.esm.js` contain identical implementations of `sampleFloorY` and `DEFAULT_FLOOR_Y`. Unify them so there is a single source of truth — keep the ESM file as canonical and make the CJS file a thin dynamic-import wrapper with no duplicated function bodies.

## Acceptance Criteria

- `game/shared/floorSampling.esm.js` remains the sole location of the `sampleFloorY` function body and `DEFAULT_FLOOR_Y` constant.
- `game/shared/floorSampling.js` contains **no** function body for `sampleFloorY` — it must be a thin wrapper (e.g. dynamic `import()` of the ESM file) that re-exports `sampleFloorY` and `DEFAULT_FLOOR_Y` via `module.exports`.
- `game/server/dungeon.js` continues to work with `require('../shared/floorSampling.js')` (exports are synchronously available at require time).
- `game/client/collision.js` continues to import from `../shared/floorSampling.esm.js` without change.
- All existing tests pass (`pnpm test` from `game/`).

## Technical Specs

- **`game/shared/floorSampling.js`** — replace entire contents with a CJS wrapper that loads the ESM module. Since Node.js `require()` is synchronous but `import()` is async, use a synchronous evaluation approach (e.g. `fs.readFileSync` + `vm.module` or a startup-time `createRequire` bridge) OR restructure so the server-side consumer accepts a top-level await / async init. The simplest reliable approach: read and `eval` the ESM source at CJS module load time, capturing the named exports.
- **`game/shared/floorSampling.esm.js`** — unchanged (remains canonical source).
- **`game/server/dungeon.js`** — no change required if the CJS wrapper preserves the same `module.exports` shape.
- **`game/client/collision.js`** — no change required.

## Verification: code
