# Hub full validation pipeline, findings, and artifact verifier

Wire `--steps full` for the hub preset so one command runs auth → hub-walk → booth → telepipe-reset, writes all screenshots and probes under `game/validation/hub/`, renders `findings.md`, and add a verifier script mirroring the Rooms ticket 277 pattern.

## Acceptance Criteria

- `harness/validate/playthrough.mjs` `--steps full` with `--preset hub` runs all hub slices sequentially and writes artifacts only under `game/validation/hub/`.
- `game/package.json`:
  - `"validate:hub": "node ../harness/validate/playthrough.mjs --preset hub --steps full --out game/validation/hub"`
  - `"validate:hub:check": "node ../harness/validate/verify-hub-artifacts.mjs"`
- New `harness/validate/lib/findingsHub.mjs` (or extend `findings.mjs` with a hub renderer) produces `game/validation/hub/findings.md` listing pass/fail for `boothDeductsGold`, `hatSwapFree`, `telepipeUpReset`, hub-walk notes, console/page errors, and screenshot filenames. Outcome is PASS only when all three assertion booleans are true; otherwise FAIL with the real probe values (never fake a pass).
- `run-summary.json` includes `"steps": "full"`, `"preset": "hub"`, `assertions` object with keys `boothDeductsGold`, `hatSwapFree`, `telepipeUpReset`, and `"ok"` reflecting all assertions.
- Required screenshots exist after a full run:
  - `01-hub-overview.png`, `02-room-operations.png`, `03-room-commerce.png`, `04-room-salon.png`
  - `05-booth-paid.png`, `06-hat-swap.png`
  - `07-telepipe-before.png`, `08-telepipe-after.png`
  - `09-lobby-finder.png`
- Also written: `probes.json`, `console.log`.
- `harness/validate/verify-hub-artifacts.mjs` exits `0` only when `run-summary.json` has `"steps": "full"`, required PNGs exist, `findings.md` is non-empty, and all three assertion keys are present; exits non-zero with a stderr list otherwise.
- Full run exits `0` when all assertions pass; exits non-zero on failure with `findings.md` explaining the real failure.
- Depends on passed sub-tickets **01–04**.

## Technical Specs

- Edit: `harness/validate/playthrough.mjs` — compose full hub run; `buildHubAssertions()`, `collectHubScreenshots()`, `writeFullArtifacts` hub variant calling hub findings renderer; non-zero exit when any assertion fails.
- New: `harness/validate/lib/findingsHub.mjs` — `renderHubFindings(run)` (mirror `harness/validate/lib/findings.mjs` structure).
- New: `harness/validate/verify-hub-artifacts.mjs` — validate `game/validation/hub/` tree (mirror `harness/validate/verify-rooms-artifacts.mjs` paths and checks).
- Edit: `game/package.json` — final `validate:hub` and `validate:hub:check` scripts.
- Writable output scope: `game/validation/hub/**` only; `harness/validate/**` for driver/verifier code.
- **Execute (implementer final action):** `cd game && pnpm validate:hub` then `cd game && pnpm validate:hub:check`; document genuine runtime failures in `findings.md` without editing `game/server/` or `game/client/` gameplay code.

## Verification: code
