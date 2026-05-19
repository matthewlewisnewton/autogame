# Cleanup nits from 049-cleanup-cleanup-encounter-telegraphs-audio

> **Staleness note.** This follow-up ticket was written against commit
> `5417f81` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `049-cleanup-cleanup-encounter-telegraphs-audio`.
None blocked acceptance — clean them up when convenient.

## `_soundLogEnabled` should be `const`

`game/client/main.js:92` declares `_soundLogEnabled` with `let`, but it is
computed once at module load and never reassigned. Using `const` better
signals the intent and avoids a misleading mutable binding.

### Acceptance Criteria
- `_soundLogEnabled` is declared with `const` in `game/client/main.js`.
- All client tests still pass (`vitest run --config vitest.config.js client/test`).
