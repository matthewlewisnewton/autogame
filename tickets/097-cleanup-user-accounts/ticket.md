# Cleanup nits from 022-user-accounts

> **Staleness note.** This follow-up ticket was written against commit
> `c33f19a` (2026-05-21). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `022-user-accounts`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Clean Up Bcrypt Build Approval Config

The package-manager config is contradictory: `game/.npmrc` lists `bcrypt@5.1.1` in `onlyBuiltDependencies`, while `game/pnpm-workspace.yaml` explicitly marks `allowBuilds.bcrypt` as `false`. The current captured run works, but the config should be made unambiguous so fresh installs do not accidentally skip bcrypt's native install/build step.

### Acceptance Criteria
- `pnpm ignored-builds` from `game/` no longer reports `bcrypt` as an explicitly ignored package build.
- The chosen pnpm build-approval config documents bcrypt consistently in one place.
