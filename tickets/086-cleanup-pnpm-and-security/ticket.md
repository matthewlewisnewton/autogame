# Cleanup nits from 018-pnpm-and-security

> **Staleness note.** This follow-up ticket was written against commit
> `b357c6a` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `018-pnpm-and-security`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Wire `check_package_age.js` into the build / CI
`game/scripts/check_package_age.js` exists but is only invokable by hand. Expose it as a `package.json` script (e.g. `"check:deps": "node scripts/check_package_age.js"`) and/or add a GitHub Actions workflow that runs it on PRs that touch lockfiles, so the supply-chain check actually gates new dependency updates.
### Acceptance Criteria
- `game/package.json` has a script entry (e.g. `check:deps`) that runs `node scripts/check_package_age.js`.
- Either a CI workflow runs the check on PRs/lockfile changes, or the script is invoked from an existing CI step. Document which.

## Remove dead local in `check_package_age.js`
At `game/scripts/check_package_age.js:33` the `const deps = node.dependencies || node.devDependencies || node.optionalDependencies;` binding is computed and never read — the function builds `depMaps` from the same fields immediately below. Drop the dead line.
### Acceptance Criteria
- The unused `const deps = ...` line is removed.
- `node game/scripts/check_package_age.js --min-age-days 7` still runs and exits 0 against the current `pnpm-lock.yaml`.
