# Cleanup nits from 221-data-debrittle-model-tests

> **Staleness note.** This follow-up ticket was written against commit
> `9e484b0` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `221-data-debrittle-model-tests`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Remove unused pickVariant import in enemy_variants.test.js
`enemy_variants.test.js` imports `pickVariant` but never references it after the de-indexing refactor. Drop the import or add a focused `pickVariant` unit test that asserts membership for a stubbed id list without going through `applyVariant`.
### Acceptance Criteria
- `enemy_variants.test.js` has no unused imports (lint-clean).
- If a `pickVariant` describe block is added, it asserts returned id ∈ `ids` and does not assert a fixed array index when `ids` length changes.

## De-index spawnEnemy variant test in server.test.js
`server/test/server.test.js` still expects `enemy.variant === ids[0]` when `rng` always returns `0.1` on a tier-1 spawn. That reintroduces registry-order churn if a variant is inserted before the current first key.
### Acceptance Criteria
- The spawn test asserts `ids.includes(enemy.variant)` (or a explicitly injected variant id) instead of `ids[0]`.
- Adding a new variant entry to `VARIANT_DEFS` without changing test file order does not fail this test.
