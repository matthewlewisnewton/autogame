# Fix bcrypt build config for pnpm 11

The previous attempt only removed `allowBuilds.bcrypt: false` from `pnpm-workspace.yaml`, which left bcrypt still ignored on fresh installs under pnpm 11. The fix must **add** `bcrypt: true` to `allowBuilds` and remove the stale `onlyBuiltDependencies` entry from `.npmrc` so that pnpm 11 actually builds bcrypt's native module on a clean `pnpm install`.

## Acceptance Criteria
- `game/pnpm-workspace.yaml` contains `allowBuilds.bcrypt: true` (alongside `esbuild: true`).
- `game/.npmrc` no longer contains a `bcrypt` entry in `onlyBuiltDependencies` (remove or replace the line so only `esbuild` remains, or remove `onlyBuiltDependencies` entirely since pnpm 11 uses `allowBuilds`).
- After `rm -rf node_modules */node_modules && pnpm install` (from `game/`), the install output does **not** contain `ERR_PNPM_IGNORED_BUILDS` for `bcrypt`.
- `pnpm ignored-builds` (from `game/`) does **not** list `bcrypt`.
- `require('bcrypt')` (or `import` equivalent) succeeds at runtime without manual `pnpm approve-builds`.

## Technical Specs
- **`game/pnpm-workspace.yaml`** — Add `bcrypt: true` under the existing `allowBuilds` key (next to `esbuild: true`).
- **`game/.npmrc`** — Remove `bcrypt@5.1.1` from the `onlyBuiltDependencies` line. Either leave only `esbuild@0.27.7` or remove the `onlyBuiltDependencies` line entirely (since pnpm 11 ignores it in favor of `allowBuilds`).
- No game code or test changes required.

## Verification: code
