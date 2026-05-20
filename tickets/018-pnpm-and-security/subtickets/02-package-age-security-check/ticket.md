# Package Age Security Check Script

Create a script that checks the publish age of all installed dependencies against the npm registry, failing if any dependency's resolved version was published less than a configurable number of days ago (default: 7).

## Acceptance Criteria
- A script exists at `game/scripts/check_package_age.js` that:
  - Reads all resolved dependencies with versions (via `pnpm ls --json` or by parsing `pnpm-lock.yaml`)
  - Queries `https://registry.npmjs.org/<package>` for each unique dependency
  - Checks the `time[version]` field (or falls back to `time.created`) to determine publish date
  - Exits with code 1 and prints a list of flagged packages if any dependency was published within the last N days (default: 7)
  - Exits with code 0 and prints a success message if no packages are too new
- The script accepts an optional `--min-age-days` argument (default: 7)
- The script is idempotent — running it multiple times produces the same result
- The script handles network errors gracefully (skips package, logs warning, does not crash)

## Technical Specs
- **File created**: `game/scripts/check_package_age.js`
- **Implementation**:
  - Use `child_process.execSync` or `spawnSync` to run `pnpm ls --json --depth Infinity` to get all resolved packages with versions
  - For each unique `name@version`, fetch `https://registry.npmjs.org/<name>` and look up `time[version]` (or fall back to `time.created`)
  - Compare against `Date.now() - (minAgeDays * 86400000)`
  - Use Node.js built-in `https` module (no external dependency) for registry fetches
  - Rate-limit: sequential fetches with a small delay (e.g., 100ms) between requests to avoid npm registry throttling
  - Parse `--min-age-days` from `process.argv`

## Verification: code
