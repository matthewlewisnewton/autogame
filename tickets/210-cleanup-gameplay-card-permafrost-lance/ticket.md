# Cleanup nits from 208-gameplay-card-permafrost-lance

> **Staleness note.** This follow-up ticket was written against commit
> `b44a4de` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `208-gameplay-card-permafrost-lance`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Refresh New Card Pack Test Wording

`game/server/test/new_card_pack.test.js` still names one definition test "all eleven new cards" and keeps `newCardIds` limited to the older pack list even though Permafrost Lance now has separate assertions. This is non-blocking, but updating the wording/list would make the test easier to read for future card additions.

### Acceptance Criteria
- The new-card-pack definition test wording and helper list accurately reflect the current card pack, including `permafrost_lance` or intentionally scoping it to legacy pack cards.
