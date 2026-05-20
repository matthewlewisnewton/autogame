# Document check:deps in CONTEXT.md

The top-level ticket requires documenting whether CI or an existing build step runs the dependency-age check. Add a brief note to `CONTEXT.md` so developers know about `check:deps` and the CI workflow.

## Acceptance Criteria
- `CONTEXT.md` mentions `pnpm run check:deps` as a local command for checking dependency ages.
- `CONTEXT.md` references `.github/workflows/check-deps.yml` and notes it runs on PRs touching `pnpm-lock.yaml`.

## Technical Specs
- **File:** `CONTEXT.md` — add a short note (1–2 lines) under the "How to Run" section or as a new "Supply-chain checks" subsection. No other changes; do not modify game code, scripts, or workflow files.

## Verification: code
