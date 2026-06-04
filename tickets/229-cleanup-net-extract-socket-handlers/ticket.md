# Cleanup nits from 210-net-extract-socket-handlers

> **Staleness note.** This follow-up ticket was written against commit
> `15a7eaf` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `210-net-extract-socket-handlers`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Normalize Socket Handler Formatting

Some callback bodies in the newly extracted `game/server/socketHandlers/deck.js` and `game/server/socketHandlers/trade.js` retained the old inline indentation after being moved out of `index.js`. The code runs correctly, but reindenting those blocks would make future reviews and edits easier.

### Acceptance Criteria
- `game/server/socketHandlers/deck.js` and `game/server/socketHandlers/trade.js` use consistent indentation for nested socket callbacks.
- Formatting-only changes do not alter socket event behavior or test expectations.
