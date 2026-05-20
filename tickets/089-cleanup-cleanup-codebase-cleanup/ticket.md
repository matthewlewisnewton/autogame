# Cleanup nits from 088-cleanup-codebase-cleanup

> **Staleness note.** This follow-up ticket was written against commit
> `05ca62d` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `088-cleanup-codebase-cleanup`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Consolidate duplicate Camera section in client config

`game/client/config.js` now has two `// ── Camera ──` blocks (projection constants above Movement, offset below Movement). Merging them into one section improves discoverability when tuning camera values.

### Acceptance Criteria
- `game/client/config.js` has a single `// ── Camera ──` section containing FOV, near/far, and `CAMERA_OFFSET`.
- No import or export renames required; `pnpm test` from `game/` still passes.

## Align spawnLoot tests with LOOT_SPAWN_CHANCE

`game/server/test/server.test.js` still mocks and comments against hardcoded `0.5` for loot spawn probability. If `LOOT_SPAWN_CHANCE` in config changes, tests may pass/fail incorrectly without reflecting the real threshold.

### Acceptance Criteria
- `spawnLoot` tests import `LOOT_SPAWN_CHANCE` from `game/server/config.js` (or shared test helper).
- Mocks use values strictly below/above that constant; comments reference the config name, not `0.5`.
- `pnpm test` from `game/` passes.
