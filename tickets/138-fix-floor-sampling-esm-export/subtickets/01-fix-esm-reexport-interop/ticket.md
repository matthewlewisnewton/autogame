# Fix ESM re-export interop for floorSampling (Vite dev compatibility)

Round 1 created `floorSampling.esm.js` using `import mod from './floorSampling.js'`, which fails under Vite dev because the CJS source has no `default` export. Replace the default import with a namespace import so Vite dev, Vite build, and vitest all resolve correctly.

## Acceptance Criteria

- `game/shared/floorSampling.esm.js` uses `import * as mod from './floorSampling.js'` (namespace import) instead of `import mod from './floorSampling.js'`.
- The re-exported named exports `sampleFloorY` and `DEFAULT_FLOOR_Y` are accessible — handled via `mod.default` fallback when the namespace object wraps the CJS `module.exports`.
- `cd game && pnpm dev` boots Vite without any `pageerror` in the browser console.
- Loading `localhost:5173/` in Playwright shows the auth overlay (no blank page).
- `game/server/dungeon.js` CJS `require` path is **unchanged** and server still boots.

## Technical Specs

- **Edit** `game/shared/floorSampling.esm.js`:
  ```js
  import * as mod from './floorSampling.js';
  const m = mod.default || mod;
  export const sampleFloorY = m.sampleFloorY;
  export const DEFAULT_FLOOR_Y = m.DEFAULT_FLOOR_Y;
  ```
  The `mod.default || mod` guard handles both Vite dev (which may wrap CJS `module.exports` under a `.default` key) and vitest/build (which may expose properties directly on the namespace).
- **Do NOT modify** `game/shared/floorSampling.js`, `game/server/dungeon.js`, or `game/client/collision.js` — they are already correct from round 1.

## Verification: code
