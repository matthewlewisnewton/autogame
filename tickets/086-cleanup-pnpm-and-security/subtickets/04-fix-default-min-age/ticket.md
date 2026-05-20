# Fix DEFAULT_MIN_AGE_DAYS to 7

CI `pnpm run check:deps` permanently fails because `DEFAULT_MIN_AGE_DAYS` was raised to `400` in commit `b73cf74`. The original value from `018-pnpm-and-security` was `7`, which matches the current lockfile baseline. Restore it so the CI gate passes on legitimate lockfile PRs.

## Acceptance Criteria
- `game/scripts/check_package_age.js` has `DEFAULT_MIN_AGE_DAYS` set to `7` (not `400`).
- Running `pnpm run check:deps` from `game/` exits 0 against the current `pnpm-lock.yaml`.

## Technical Specs
- **File:** `game/scripts/check_package_age.js` — change `const DEFAULT_MIN_AGE_DAYS = 400;` (line ~158) to `const DEFAULT_MIN_AGE_DAYS = 7;`. No other changes; do not touch the whitelist, the CI workflow, or any other file.

## Verification: code
