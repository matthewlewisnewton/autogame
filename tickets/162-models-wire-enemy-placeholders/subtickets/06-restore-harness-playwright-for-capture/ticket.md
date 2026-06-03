# Restore harness Playwright dependency for screenshot capture

Round-1 capture failed with `ERR_MODULE_NOT_FOUND: Cannot find package
'playwright'` when running `harness/screenshot.mjs`, so `metrics.json` reported
`ok: false` / `capture_failed` and no browser `console.log` was produced. Ensure
the worktree can resolve `playwright` from `harness/screenshot.mjs` (install or
fix the `harness/node_modules` link) so the ticket capture step can run cleanly.

## Acceptance Criteria

- From the repo root, `node --input-type=module -e "import('playwright')"`
  executed with cwd `harness/` (or equivalent resolution used by
  `screenshot.mjs`) completes without `ERR_MODULE_NOT_FOUND`.
- `harness/node_modules/playwright` exists and resolves (real install or valid
  symlink to a checkout that has Playwright installed).
- If `harness/node_modules` is a broken symlink (e.g. "Too many levels of
  symbolic links"), `link_harness_deps` in `harness/dispatch/worktree_setup.py`
  removes/replaces it and links to a valid main-checkout `node_modules`, or the
  sub-ticket documents and applies `pnpm install` under `harness/` when linking
  is not possible.
- A focused harness unit test covers broken-symlink recovery (extend
  `harness/tests/unit/test_worktree_setup.py` or adjacent test).
- No changes to game rendering logic (`game/client/**`) unless required by an
  unrelated compile error (should be none).

## Technical Specs

- `harness/dispatch/worktree_setup.py` — in `link_harness_deps`, treat an
  existing `harness/node_modules` symlink as valid only when
  `(dst / "playwright").exists()` (or `import.meta.resolve('playwright')`
  equivalent check); unlink and re-link when broken; keep idempotent behavior for
  a healthy link.
- `harness/package.json` — already lists `playwright`; run `pnpm install` in
  `harness/` on the main checkout (or this worktree) if `node_modules` is missing.
- `harness/tests/unit/test_worktree_setup.py` — add a case: broken/cyclic
  symlink at `dst` is replaced and Playwright becomes resolvable when `src` is
  populated.
- Do not edit `harness/screenshot.mjs` capture recipe content unless import path
  must change after deps are fixed (unlikely).
- Do not modify passed sub-tickets `01`–`04` or their folders.

## Verification: code
