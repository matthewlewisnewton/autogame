# Cleanup nits from 156-docs-design-md-stale-fixes

> **Staleness note.** This follow-up ticket was written against commit
> `23f81aa` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `156-docs-design-md-stale-fixes`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Telepipe section still uses "Magic Stones" label

The Combat Mechanics section was updated to **Mystic Signal (MS)** per `shared/theme.json`, but the Telepipe bullet in **Run Suspend / Resume** still says "costs 0 Magic Stones." The cost (0) is correct; the player-facing name is stale within the same file.
### Acceptance Criteria
- In `game/docs/design.md` Run Suspend / Resume, replace "Magic Stones" with "Mystic Signal" or "MS" for the Telepipe cost line, consistent with the `### Player-Facing Currency` subsection.
