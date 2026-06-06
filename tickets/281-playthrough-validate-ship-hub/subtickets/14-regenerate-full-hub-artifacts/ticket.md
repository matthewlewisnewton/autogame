# Regenerate full hub validation artifacts and sync findings

Latest `game/validation/hub/run-summary.json` is a partial `telepipe-reset` run while `findings.md` overstates all three asserts as PASS. Regenerate a single honest `--steps full` run so artifacts, findings, and `verify-hub-artifacts.mjs` agree.

## Acceptance Criteria

- **Implementer final action (required for QA):** from repo root:
  `cd game && pnpm validate:hub && pnpm validate:hub:check`
  (full hub playthrough, not `--steps telepipe-reset` alone).
- `game/validation/hub/run-summary.json` has `"steps": "full"`, `"preset": "hub"`, `"ok": true` (or `false` with honest failure), and `assertions` containing all three keys: `boothDeductsGold`, `hatSwapFree`, `telepipeUpReset` with boolean values matching probe evidence.
- `game/validation/hub/findings.md` is rewritten from the same run: Outcome PASS only when all three assertion booleans are true; on failure document real probe values and mark FAIL (never claim PASS for asserts absent from `run-summary.json`).
- Required PNGs exist: `01-hub-overview.png` through `09-lobby-finder.png`; `probes.json` and `console.log` present.
- `pnpm validate:hub:check` exits `0`.
- If any assert fails at runtime, exit non-zero from `validate:hub`, keep screenshots, and record the genuine failure in `findings.md` — do not edit gameplay code to fake a pass.
- Depends on sub-tickets **12** and **13**.

## Technical Specs

- Runnable commands: `game/package.json` scripts `validate:hub` and `validate:hub:check` (already wired in sub-ticket **05**).
- Driver: `harness/validate/playthrough.mjs` `--preset hub --steps full`; findings renderer `harness/validate/lib/findingsHub.mjs`; verifier `harness/validate/verify-hub-artifacts.mjs`.
- Writable output only under `game/validation/hub/`: `run-summary.json`, `findings.md`, `probes.json`, `console.log`, `server.log`, `01-*.png` … `09-lobby-finder.png`.
- Fix harness/findings drift only if the full run exposes a renderer bug; no `game/server/` or `game/client/` gameplay edits.

## Verification: code
