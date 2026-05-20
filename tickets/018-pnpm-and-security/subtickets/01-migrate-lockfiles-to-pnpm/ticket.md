# Migrate Lockfiles from npm to pnpm

Replace all `package-lock.json` files with `pnpm-lock.yaml` by running `pnpm install` in each workspace directory. This is the foundational step — without it, subsequent sub-tickets have no pnpm workspace to work with.

## Acceptance Criteria
- `game/package-lock.json`, `game/server/package-lock.json`, `game/client/package-lock.json` are deleted
- `game/pnpm-lock.yaml` exists at the root of the `game/` workspace
- `harness/package-lock.json` is deleted and replaced with `harness/pnpm-lock.yaml`
- `node_modules` folders under `game/` and `harness/` are populated (dependencies installed via pnpm)
- `pnpm test` runs successfully from `game/` (all existing tests pass)

## Technical Specs
- **Files removed**: `game/package-lock.json`, `game/server/package-lock.json`, `game/client/package-lock.json`, `harness/package-lock.json`
- **Files created**: `game/pnpm-lock.yaml`, `harness/pnpm-lock.yaml`
- **Steps**:
  1. Delete all existing `package-lock.json` files and `node_modules` directories
  2. Run `pnpm install` in `game/` (this resolves the workspace with `game/server/` and `game/client/` as sub-packages)
  3. Run `pnpm install` in `harness/`
  4. Verify `pnpm test` passes in `game/`

## Verification: code
