1. `floorSampling.esm.js` default-imports CJS; Vite dev throws `does not provide an export named 'default'` and the client page stays blank.
   Files: `game/shared/floorSampling.esm.js` (and verify via `game/client/collision.js` import chain)
   Fix: Replace `import mod from './floorSampling.js'` with interop that works in Vite dev — e.g. `import * as mod from './floorSampling.js'` and read `sampleFloorY` / `DEFAULT_FLOOR_Y` from `mod` (or `mod.default` if present). Confirm with `cd game/client && npx vite --port 5174 --strictPort` + Playwright: zero `pageerror`, auth overlay visible. Alternatively convert `floorSampling.js` to ESM `export` syntax and add a thin server CJS shim (heavier).

2. Round-1 harness capture did not start servers (`metrics.json` `"ok": false`; ports 5173/3000 already held by stale vite/server PIDs).
   Files: none — harness infra, not game code
   Fix: Operator stops foreign holders on 5173 and 3000, re-runs capture after gap 1 is fixed so `metrics.json` is `"ok": true` and `console.log` exists with no `pageerror`.
