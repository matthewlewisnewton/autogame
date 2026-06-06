# Cleanup nits from 280-playthrough-validate-spire-ascent

> **Staleness note.** This follow-up ticket was written against commit
> `bbcf8ef7` (2026-06-06). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `280-playthrough-validate-spire-ascent`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Improve Spire Validation Screenshot Framing

The Spire validation assertions and probes are solid, but a few screenshots are more cluttered than ideal for later human triage: the hub image still has a booth/forge panel open, and the boss-defeated and victory captures are effectively the same run-summary overlay. Cleaner framing would make future visual reviews easier without changing the validation logic.

### Acceptance Criteria
- The Spire validation capture closes transient hub panels before the hub screenshot, when possible.
- The boss-defeated/victory screenshots either capture distinct meaningful states or the findings file explicitly notes that immediate victory makes them equivalent.
