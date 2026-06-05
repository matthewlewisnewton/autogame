# Cleanup nits from 234-booth-quest-counter

> **Staleness note.** This follow-up ticket was written against commit
> `1c5ca423` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `234-booth-quest-counter`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Remove Unused Quest Booth Import
`game/client/main.js` imports `QUEST_BOOTH_ID` from `game/client/questBooth.js`, but the file only uses `isQuestBoothAction()`. Removing the unused import would keep the module tidy and avoid future lint noise if stricter checks are enabled.

### Acceptance Criteria
- `game/client/main.js` imports only the quest booth symbols it uses.
