# Harness Playwright deps for screenshot capture

Round 4 exhausted sub-ticket **08** because the implementer scope is `game/**`
(+ `harness/**` when the ticket references `harness/`) — **not** the repo-root
`.gitignore`. Edits to `.gitignore` were reverted every iteration. Game spike
work (**02–06**) is already done; this sub-ticket finishes harness infra so
`harness/screenshot.mjs` can `import 'playwright'`, workers install/link deps,
and top-level review capture returns `"ok": true`.

Sub-ticket **01** is retired: the decision record lives in passed sub-ticket
**06** (`game/docs/SPIKE_DECISION.md`); do not recreate `tickets/.../DECISION.md`.

## Acceptance Criteria

- `harness/.gitignore` contains `!package-lock.json` so `harness/package-lock.json`
  is trackable despite the root `**/package-lock.json` rule (`git check-ignore
  harness/package-lock.json` exits **1**; `git add harness/package-lock.json`
  succeeds without `-f`).
- `harness/package-lock.json` exists, pins `playwright` ^1.60.0, and appears in
  the sub-ticket diff (committed, not ignored).
- `harness/node_modules/playwright` exists in this worktree after
  `install_harness_deps()` or a valid `link_harness_deps()` symlink target.
- From the repo root, `node -e "import('playwright')"` run with cwd/`NODE_PATH`
  consistent with `node harness/screenshot.mjs` succeeds (no
  `ERR_MODULE_NOT_FOUND`).
- `install_harness_deps()` in `harness/dispatch/worktree_setup.py` runs `npm ci`
  when `harness/package-lock.json` exists, else `npm install`; idempotent when
  playwright is already present.
- `harness/cli.py` worker path calls `install_harness_deps` then
  `link_harness_deps` immediately after `install_deps`.
- Unit tests in `harness/tests/unit/test_worktree_setup.py` cover
  install-when-missing and no-op-when-present paths;
  `python -m pytest harness/tests/unit/test_worktree_setup.py` passes.
- Sub-ticket capture artifacts: `screenshot.log` does **not** contain
  `Cannot find package 'playwright'`; `metrics.json` has `"ok": true` when dev
  servers start.
- **Do not edit** repo-root `.gitignore`, any file under `game/`, or passed
  sub-ticket folders **02–06**.

## Technical Specs

**Allowed paths only** (scope audit reverts anything else):

- **Edit** `harness/.gitignore` — append `!package-lock.json` (negates the root
  blanket lockfile ignore for this directory only; do **not** touch `.gitignore`
  at repo root).
- **Add** `harness/package-lock.json` — run `npm install` in `harness/` if not
  already present; must pin `playwright` ^1.60.0.
- **Edit** `harness/dispatch/worktree_setup.py` — ensure `install_harness_deps()`
  and `_harness_playwright_present()` exist; prefer `npm ci` when lockfile exists.
- **Edit** `harness/cli.py` — call `install_harness_deps` then `link_harness_deps`
  in the worker entry path after `install_deps`.
- **Edit** `harness/tests/unit/test_worktree_setup.py` — cover harness install and
  link behavior.

Prior round may have left partial harness changes in the working tree — verify
each acceptance criterion and fill any gaps. `harness/package.json` already
declares `playwright` ^1.60.0; do not modify game assets or docs.

## Verification: code
