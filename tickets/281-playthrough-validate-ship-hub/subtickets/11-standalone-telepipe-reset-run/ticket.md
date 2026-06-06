# Standalone `--steps telepipe-reset` run and validation artifacts

Execute the hub telepipe-reset slice end-to-end via `playthrough.mjs` (not `harness/screenshot.mjs` resume capture, not `game/client/scripts/test-telepipe-suspend-resume.mjs`). Produce `game/validation/hub/` artifacts with `"steps": "telepipe-reset"` and honest `telepipeUpReset` reflecting abandon+fresh-deploy probes from sub-ticket **10**.

## Acceptance Criteria

- **Implementer final action (required for QA):** from repo root, run:
  `node harness/validate/playthrough.mjs --preset hub --steps telepipe-reset --out game/validation/hub`
  Do **not** use `--steps full`, `test-telepipe-suspend-resume.mjs`, or rely on iter screenshot capture as the telepipe-reset proof.
- `game/package.json` adds `"validate:hub:telepipe-reset"` running the command above.
- Step flow: solo deploy via `telepipe-ready` + `window.__launchReadyUpForTest()` → deplete MS/charges → screenshot `07-telepipe-before.png` → telepipe UP suspend → `abandonSuspendedRun` → fresh deploy → screenshot `08-telepipe-after.png`.
- `preSuspend`: `magicStones < STARTING_MAGIC_STONES` (49) and at least one hand slot with `remainingCharges < charges`.
- `postDeploy`: `magicStones === 49`, all occupied slots at full charges, `postDeploy.runId !== preSuspend.runId`, server log slice has no `[run] checkpoint restored`.
- `game/validation/hub/run-summary.json` written with `"steps": "telepipe-reset"`, `"preset": "hub"`, `telepipeReset.telepipeUpReset === true`, `assertions.telepipeUpReset === true`, and probe objects including `runId`.
- Command exits `0` when `telepipeUpReset` is true; exits non-zero with probe values in `run-summary.json` / stderr on failure (never fake a pass).
- Re-running `cd game && pnpm validate:hub` after this sub-ticket still works; full-run `telepipeUpReset` must reflect the corrected assertion logic from sub-ticket **10**.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- Edit: `harness/validate/playthrough.mjs` — confirm standalone `telepipe-reset` branch writes `run-summary.json` with `steps: opts.steps`, sets `exitCode` from `telepipeUpReset`, copies `console.log` to output dir.
- Edit: `game/package.json` — `validate:hub:telepipe-reset` script.
- Reuse: `harness/validate/lib/telepipe.mjs` `runTelepipeResetStep` (sub-ticket **10**), preset `harness/validate/presets/hub.mjs`.
- Writable output: `game/validation/hub/07-telepipe-before.png`, `08-telepipe-after.png`, `run-summary.json`, `console.log` (overwrite telepipe fields only; preserve 01–06 hub screenshots if present).
- Depends on sub-tickets **08–10**.

## Verification: code
