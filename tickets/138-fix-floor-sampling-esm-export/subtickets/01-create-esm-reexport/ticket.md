# Create ESM re-export for floorSampling and wire client import

The client's `import { sampleFloorY, DEFAULT_FLOOR_Y }` from `floorSampling.js` fails because the source file uses CJS `module.exports`. Create a thin ESM re-export sibling and point the client at it, leaving the server's CJS `require` untouched.

## Acceptance Criteria

- `game/shared/floorSampling.esm.js` exists and re-exports `sampleFloorY` and `DEFAULT_FLOOR_Y` as ESM named exports from the CJS source.
- `game/client/collision.js` imports from `../shared/floorSampling.esm.js` instead of `../shared/floorSampling.js`.
- `game/server/dungeon.js` import path is **unchanged** (still `require('../shared/floorSampling.js')`).
- `game/shared/floorSampling.js` is **unchanged** (still uses `module.exports`).
- `cd game && pnpm dev` boots without page errors; the client bundles successfully under Vite.

## Technical Specs

- **Create** `game/shared/floorSampling.esm.js`:
  ```js
  import mod from './floorSampling.js';
  export const { sampleFloorY, DEFAULT_FLOOR_Y } = mod;
  ```
- **Edit** `game/client/collision.js`: change the import path from `'../shared/floorSampling.js'` to `'../shared/floorSampling.esm.js'`.

## Verification: code
