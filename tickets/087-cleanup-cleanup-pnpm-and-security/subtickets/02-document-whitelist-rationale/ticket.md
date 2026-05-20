# Document dependency whitelist rationale

`check_package_age.js` whitelists `@types/node`, `rollup`, `vite`, `qs`, `@rollup/*`, and `@vitejs/*` so the age gate passes while those toolchain packages are younger than the minimum age. The whitelist is currently undocumented beyond inline code. Add a comment block explaining the rationale and when to extend the list.

## Acceptance Criteria

- The `WHITELISTED_PACKAGES` set and `isWhitelisted()` function in `check_package_age.js` are preceded by a comment block explaining:
  - Why these packages bypass the age gate (they are dev/build tooling that receives frequent updates, not application dependencies).
  - When a new package should be added to the whitelist (dev/build tooling only; never runtime/application dependencies).
- Each whitelisted package or glob pattern has an inline comment naming the reason (e.g., `// build bundler — frequent minor releases`).
- No logic changes to `WHITELISTED_PACKAGES` or `isWhitelisted()` — comments only.

## Technical Specs

- **File to change:** `game/scripts/check_package_age.js`
- Add a multi-line comment block above the `WHITELISTED_PACKAGES` constant explaining the whitelist purpose and extension policy.
- Add inline `// ...` comments next to each entry in `WHITELISTED_PACKAGES` and for the glob patterns in `isWhitelisted()`.
- This is a comments-only change — no logic modifications, no other files touched.

## Verification: code
