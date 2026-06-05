# Cleanup nits from 268-scaling-thread-lobby-state-explicitly

> **Staleness note.** This follow-up ticket was written against commit
> `84c1dee` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `268-scaling-thread-lobby-state-explicitly`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Add Explicit-State Regression Tests For Migrated Helpers

The migrated progression helpers now accept explicit state arguments, but most existing unit coverage still calls the default global/context path. Adding a small set of tests with two distinct state objects would better protect the future concurrent-lobby goal from accidental fallback to `_gameState`.

### Acceptance Criteria

- Add focused server tests proving at least one migrated helper from each flow (shop/medic, card reward, run teardown) mutates or reads the explicitly supplied state rather than the module-level default.
