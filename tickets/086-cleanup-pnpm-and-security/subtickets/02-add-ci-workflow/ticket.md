# Add GitHub Actions workflow for dependency age check

Create a GitHub Actions workflow that runs `check_package_age.js` on PRs touching lockfiles, gating supply-chain risk from freshly published packages.

## Acceptance Criteria
- A `.github/workflows/check-deps.yml` (or similar) file exists in the repository root.
- The workflow triggers on `pull_request` events when `pnpm-lock.yaml` is changed.
- The workflow runs `pnpm install` followed by `pnpm run check:deps` (or `node scripts/check_package_age.js`) and fails the check if the script exits non-zero.

## Technical Specs
- **New file:** `.github/workflows/check-deps.yml` — standard GHA workflow YAML.
  - `on: pull_request: paths: ['**/pnpm-lock.yaml']`
  - Jobs: install pnpm, run `pnpm install`, then `pnpm run check:deps`.
  - Use a recent Node.js runner (e.g., `node-version: '20'`).

## Verification: code
