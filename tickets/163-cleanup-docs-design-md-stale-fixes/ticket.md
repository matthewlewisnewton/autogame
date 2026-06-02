# Cleanup nits from 156-docs-design-md-stale-fixes

> **Staleness note.** This follow-up ticket was written against commit
> `4ced005` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `156-docs-design-md-stale-fixes`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Exclude harness subticket files from implementation branch diff

Top-level acceptance says only `game/docs/design.md` should change; `git diff` from baseline also adds `tickets/156-docs-design-md-stale-fixes/subtickets/*/ticket.md`. These are decomposition metadata, not game deliverables, but they muddy literal AC compliance and review scope.
### Acceptance Criteria
- Implementation commits for doc-only tickets contain changes under `game/docs/` only (harness ticket folders updated separately or left untracked).
