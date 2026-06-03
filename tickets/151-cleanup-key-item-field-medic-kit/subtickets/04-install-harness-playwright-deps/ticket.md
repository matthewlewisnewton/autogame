# Install harness Playwright dependencies for screenshot capture

Round-1 review failed with `metrics.json` `"ok": false` because `harness/screenshot.mjs` could not resolve the `playwright` package (`ERR_MODULE_NOT_FOUND` in `round-1/screenshot.log`). All three game-code nits (description, shared heal radius, lobby broadcast VFX) already passed their sub-tickets; this sub-ticket restores harness capture so the top-level ticket can complete runtime verification.

## Acceptance Criteria

- `harness/node_modules/playwright` exists and is resolvable (real install or valid symlink — not broken or self-referential).
- Running `node harness/screenshot.mjs <url> <outDir>` no longer fails at import time with `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'`.
- When dev servers are running, a smoke capture produces `metrics.json` with `"ok": true` and writes at least one screenshot plus `console.log` (same success shape as a healthy round-1 capture).
- **No files under `game/` are modified** — this is harness infrastructure only.

## Technical Specs

- **Operational**: From the repo root, ensure harness deps are installed:
  - If `harness/node_modules` is a broken symlink (missing target or no `playwright` inside), remove it.
  - Run `pnpm install --frozen-lockfile` in `harness/` (lockfile: `harness/pnpm-lock.yaml`; dependency declared in `harness/package.json`).
  - If browser binaries are missing after package install, run `pnpm exec playwright install chromium` from `harness/`.
- **Optional hardening** (recommended if the broken symlink recurs across worktrees): `harness/dispatch/worktree_setup.py` — extend `link_harness_deps()` to verify `(dst / "playwright").exists()` after linking; when the link is missing or broken, remove it and fall back to local `pnpm install --frozen-lockfile` in `harness/` (mirror the pattern used by `install_deps()` for game deps). Wire the fallback from `harness/cli.py` worker setup if not already invoked on link failure.
- **Harness test** (if code changes): add or extend a unit test in `harness/tests/unit/test_worktree_setup.py` covering the broken-symlink fallback path.
- **Do not modify** any files under `game/`.

## Verification: code
