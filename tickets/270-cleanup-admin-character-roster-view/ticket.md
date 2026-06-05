# Cleanup nits from 264-admin-character-roster-view

> **Staleness note.** This follow-up ticket was written against commit
> `2340fa7` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `264-admin-character-roster-view`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Defensively Copy Admin Roster Data

`buildAdminRoster()` currently returns nested account and persisted objects/arrays by reference. The current `/admin` view only renders them and does not mutate state, but returning cloned nested data would better match the read-only contract and reduce future foot-guns if another caller reuses the roster aggregation.

### Acceptance Criteria
- `buildAdminRoster()` returns cloned copies of nested fields such as `cosmetic`, `unlockedHats`, `unlockedQuestTiers`, `selectedDeck`, and `ownedCards`.
- Existing admin roster and admin view tests still pass, with at least one assertion that mutating a returned roster entry does not mutate the underlying user or persisted player data.
