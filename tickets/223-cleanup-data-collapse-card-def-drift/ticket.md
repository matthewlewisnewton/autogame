# Cleanup nits from 222-data-collapse-card-def-drift

> **Staleness note.** This follow-up ticket was written against commit
> `1d2c12b` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `222-data-collapse-card-def-drift`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Refresh Stale Card Module Comments

`game/client/cards.js` still has a couple of comments that describe the shared import as an "identity subset" and mention old card type examples like `summon` / `monster`. The code is correct, but the comments now lag the shared full-stat data model and may confuse future card-data work.

### Acceptance Criteria
- Comments in `game/client/cards.js` accurately describe `game/shared/cardDefs.json` as the full shared card stat source and list the current card types.
