# Restore Browser-Capture Proof: Resolve Playwright for `harness/screenshot.mjs`

The open-plaza game code already satisfies every acceptance criterion of the
top-level ticket (confirmed by the round-3 review). The ONLY thing blocking a
PASS is that the harness browser capture cannot run: `harness/screenshot.mjs`
does a bare `import { chromium } from 'playwright'`, and Node resolves that by
walking up from `harness/` (→ `harness/node_modules` → repo-root
`node_modules`), neither of which exists. The sole installed copy lives at
`game/client/node_modules/playwright`, which Node's resolver never reaches from
a `harness/` script. As a result `metrics.json` reports
`"ok": false` / `failure_kind: "capture_failed"` and `screenshot.log` shows
`ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'` — identically in
rounds 1, 2, and 3. Make the capture resolve the already-installed Playwright
so a clean browser run can be produced.

> Scope note: the defect is exclusively in `harness/screenshot.mjs`; there is no
> `game/`-only change that can fix Node module resolution for a script that
> lives under `harness/`. The round-3 review explicitly attributed the gap to
> "none in `game/`". This sub-ticket therefore changes that one harness file and
> nothing else.

## Acceptance Criteria

- `harness/screenshot.mjs` resolves Playwright's `chromium` successfully even
  when neither `harness/node_modules` nor a repo-root `node_modules` contains
  `playwright`, by falling back to the already-installed copy at
  `game/client/node_modules/playwright`.
- A normal capture invocation (`node harness/screenshot.mjs <url> <outDir>`)
  no longer fails at import time: `screenshot.log` contains no
  `ERR_MODULE_NOT_FOUND` / `Cannot find package 'playwright'`.
- When the dev servers are up, the capture completes and writes
  `metrics.json` with `"ok": true` (no `failure_kind: "capture_failed"`) and a
  clean browser `console.log` (no page errors).
- The existing capture behavior is otherwise unchanged: the same allowlisted
  recipe steps, the same screenshot/metrics output shape, and the standard
  bare `import 'playwright'` path is still used first when it resolves (so a
  properly provisioned environment is unaffected).

## Technical Specs

- `harness/screenshot.mjs`: replace the static top-level
  `import { chromium } from 'playwright'` (line ~10) with resilient resolution
  of `chromium`:
  1. Try the normal specifier first (`await import('playwright')`) so a
     correctly provisioned environment keeps working unchanged.
  2. On failure (`ERR_MODULE_NOT_FOUND`), fall back to the in-repo copy using
     `createRequire(import.meta.url)` and an absolute path derived from the
     script location, e.g.
     `require(resolve(harnessDir, '..', 'game', 'client', 'node_modules', 'playwright'))`,
     then take `.chromium` from it.
  - `harnessDir` / `repoRoot` are already computed in the file; reuse them. If
    the resolution must happen before those consts, compute the path inline
    from `fileURLToPath(import.meta.url)`.
  - Keep `chromium` available to the rest of the module exactly as before
    (the launch call `chromium.launch(...)` must be unchanged).
- Do not change any other file, the recipe schema, the console-noise filter,
  or the output artifact format.

## Verification: code
