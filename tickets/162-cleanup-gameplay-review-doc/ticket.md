# Cleanup nits from 155-gameplay-review-doc

> **Staleness note.** This follow-up ticket was written against commit
> `7893ae3` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `155-gameplay-review-doc`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Align design.md deck size with server caps

`game/docs/design.md` still describes equipping “up to 12 cards” while `DECK_MAX_SIZE` is 24 in `game/server/config.js`. `gameplay-review.md` correctly documents 4–24 from code; a small design-doc pass would remove reader confusion when comparing the review to the GDD.

### Acceptance Criteria
- `design.md` states deck bounds consistent with `DECK_MIN_SIZE` / `DECK_MAX_SIZE` (or explicitly notes “12 recommended, 24 max” if that is the product intent).
- No contradiction between design.md, gameplay-review.md, and lobby UI copy.

## Expand Current gameplay run-objective paragraph

The capture HUD shows an active objective (“Initiate Vault: Purge hostiles…”) and `formatObjectiveSummary` / `startDungeonRun` are central to the loop, but **Current gameplay** spreads objective detail across telepipe and co-op subsections rather than one tight “run objectives” blurb.

### Acceptance Criteria
- `game/docs/gameplay-review.md` **Current gameplay** includes 2–4 sentences on how quests map to objectives, progress tracking, and victory/failure (with `game/server/progression.js` / `game/client/questBoard.js` citations).
- A reader unfamiliar with the codebase understands purge/crystal-style goals without inferring from Improvements only.
