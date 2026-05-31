# Fix: floorSampling.js named exports unavailable to client (ESM/CJS mismatch)

**Severity: BLOCKING.** The client cannot boot the game with the slope work
landed (commits `8598df9` + `6f0c78d` from ticket 116). All routes —
`localhost:5173/`, `/?debugScenario=sloped-dungeon`, etc. — fail at module
load with an uncaught error in `main.js`'s import graph, leaving the page
blank (no auth overlay, no scene, no harness state hook). The harness's
code-mode QA never catches this because it only reads diffs and pipeline
logs, not the running app.

## Difficulty: easy

## Goal

Make `game/shared/floorSampling.js` provide both `sampleFloorY` and
`DEFAULT_FLOOR_Y` as **named exports** that both:

- the **client** can `import { … } from '…'` from `game/client/collision.js`
  (which Vite/native ESM treats as a strict ESM module), AND
- the **server** can `const { … } = require('…')` from
  `game/server/dungeon.js` (which the Node server runs as CommonJS).

…without any wrapper layer or duplicated source.

## Problem

`game/shared/floorSampling.js` currently uses CommonJS:

```js
module.exports = { sampleFloorY, DEFAULT_FLOOR_Y };
```

`game/server/dungeon.js` consumes it as CJS:

```js
const { sampleFloorY, DEFAULT_FLOOR_Y } = require('../shared/floorSampling.js');
```

But `game/client/collision.js` consumes it as **ESM with named imports**:

```js
import { sampleFloorY as _sampleFloorY, DEFAULT_FLOOR_Y as _DEFAULT_FLOOR_Y } from '../shared/floorSampling.js';
```

Vite's dev server (esbuild) sees the file path through the client's module
graph, treats `.js` as ESM by default (the client package has
`"type": "module"`), and **cannot statically extract named exports from
`module.exports = {…}`**. The page errors at load time:

```
Uncaught SyntaxError: The requested module
'/@fs/.../game/shared/floorSampling.js' does not provide an export named
'DEFAULT_FLOOR_Y'
```

This is reproducible right now with:

```bash
cd game/client && npx vite --port 5174 --strictPort
# then headless: load localhost:5174 in playwright, check pageerror
```

…and was observed live on 2026-05-31 by a manual probe (see
`/tmp/slope-probe/` for screenshots / state dump). It is fully invisible to
the harness's code-mode QA path (which reads diffs and the pipeline log;
the page is broken at runtime only).

## Acceptance Criteria

- `game/shared/floorSampling.js` is consumable simultaneously by:
  - **Server** (`game/server/dungeon.js`, executed by `node game/server/index.js`
    in plain CJS mode) — `const { sampleFloorY, DEFAULT_FLOOR_Y } = require(…)`
    must continue to work, and the server must still boot to
    `Server listening on port 3000` with no module-resolution errors.
  - **Client** (`game/client/collision.js`, bundled by Vite as ESM) —
    `import { sampleFloorY, DEFAULT_FLOOR_Y } from '../shared/floorSampling.js'`
    must succeed under `pnpm dev` AND `pnpm build` with no pageerror in
    the browser console.
- Walking the homepage in a fresh playwright session (no localStorage)
  produces **no `Uncaught SyntaxError` / no `does not provide an export
  named` errors** in the console. The auth overlay is visible. After
  register+login, `window.__AUTOGAME_HARNESS_STATE__()` returns a state
  object with `phase === 'playing'` once a quest starts.
- `game/client/test` and `game/server/test` vitest suites still pass:
  `pnpm --filter client test && pnpm --filter server test`.
- Behaviour of `sampleFloorY` is unchanged — bilinear interpolation over
  `floorCorners`, returns the flat `DEFAULT_FLOOR_Y` for rooms without
  `floorCorners`, and `null` for `(x,z)` outside all rooms. The existing
  unit tests in `game/server/test/dungeon.test.js` (added in commit
  `2453fab`) still pass without modification.

## Technical Specs

- **Files**:
  - `game/shared/floorSampling.js` — switch the export style.
  - Possibly `game/server/dungeon.js` if a small consumer-side adapter is
    chosen instead. Do NOT change `game/client/collision.js` if at all
    avoidable — the client's import expression is correct for ESM.

- **Recommended approach: rename to `.mjs` OR pivot to dual-package.**
  Three working options, in order of cleanliness:

  1. **Rename file to `floorSampling.mjs` + ESM syntax.** Server's
     `require()` does not natively load `.mjs`; convert server caller to
     `const { sampleFloorY, DEFAULT_FLOOR_Y } = await import('../shared/floorSampling.mjs')`
     at module top, or restructure dungeon.js to be async-init. Heaviest
     server change.

  2. **Switch source to ESM in-place (keep `.js`), add a CJS shim.**
     `game/shared/floorSampling.js` uses `export { sampleFloorY,
     DEFAULT_FLOOR_Y }`. Server's `require` call goes through a thin
     `game/shared/floorSampling.cjs` shim:
     `module.exports = { sampleFloorY: undefined, DEFAULT_FLOOR_Y: undefined };
      Object.assign(module.exports, require('node:module').createRequire(...));`
     — but `require()` of an ESM file still rejects in Node CJS, so the
     shim has to use `await import()` and the server has to be async.
     Same complexity as (1).

  3. **(Recommended) Keep CJS source AND add an ESM re-export sibling.**
     Create `game/shared/floorSampling.esm.js` (or `.mjs`) that does:
     ```js
     import mod from './floorSampling.js';
     export const { sampleFloorY, DEFAULT_FLOOR_Y } = mod;
     ```
     Then change ONLY `game/client/collision.js` to import from
     `../shared/floorSampling.esm.js`. Server keeps its CJS `require`
     unchanged. Tiny and surgical. Single file added, one import path
     swapped.

  4. **Alternative (cleanest long-term but bigger):** convert the whole
     server to ESM (`"type": "module"` in `game/server/package.json`,
     `import`/`export` throughout). Out of scope for this ticket.

  **Pick (3) unless you have a reason to prefer otherwise.** It's minimal,
  reversible, and doesn't touch the server's runtime model.

- **Test**: add `game/client/test/shared-floor-sampling.test.js` that
  imports both names via ESM (`import { sampleFloorY, DEFAULT_FLOOR_Y }
  from '../../shared/floorSampling.esm.js'`) and asserts:
  - `DEFAULT_FLOOR_Y === 0.5`
  - `sampleFloorY({rooms:[]}, 0, 0) === null`
  - `sampleFloorY({rooms:[{x:0,z:0,width:10,depth:10}]}, 0, 0) === 0.5`
  - One sloped-room case with non-trivial `floorCorners` that returns the
    interpolated value at the centre.

  This guards the regression at the import level.

- **Manual verification (must do before declaring done)**:
  1. `cd game && pnpm dev` (or equivalent harness-style server + vite).
  2. Open `localhost:5173/` headless in playwright.
  3. Capture `page.on('pageerror', …)` — must be empty.
  4. Register + log in, wait for `phase === 'playing'`.
  5. Take a screenshot, attach to the QA evidence.

## Verification: code

(QA mode `code` is fine — once the regression test in
`game/client/test/shared-floor-sampling.test.js` exists, any future
breakage of named-exports will surface in the vitest run that the harness
already runs. The manual verification step above is a one-shot
implementer-side smoke check, not an ongoing harness gate.)

## Notes

- This bug was missed by every QA tier in rounds 1–3 of ticket 116. See
  **ticket 139** for the parallel harness ticket that makes pageerrors
  catchable in QA mode.
- Once 138 is fixed, ticket 116 itself should re-run cleanly — the actual
  slope work is correct, it's just unreachable from a running client today.
- 117 (sloped movement, already on disk under
  `tickets/117-sloped-movement-server-and-client/`) hard-depends on 138
  landing first; until then, the client never gets to the playing state
  where movement matters.
