# Remove dead local in check_package_age.js

The `collectPackages()` function at line 33 computes `const deps = node.dependencies || node.devDependencies || node.optionalDependencies` but never reads it — the function immediately rebuilds the same data via `depMaps`. Remove the unused binding.

## Acceptance Criteria
- The line `const deps = node.dependencies || node.devDependencies || node.optionalDependencies;` is removed from `collectPackages()` in `game/scripts/check_package_age.js`.
- `node game/scripts/check_package_age.js --min-age-days 7` still runs and exits 0 against the current `pnpm-lock.yaml`.

## Technical Specs
- **File:** `game/scripts/check_package_age.js` — delete line 33 (`const deps = ...`) inside the `collectPackages` function. No other changes needed.

## Verification: code
