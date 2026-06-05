# Cleanup nits from 276-socketHandlers-extract-run-and-cleanup

> **Staleness note.** This follow-up ticket was written against commit
> `2bfc35dd` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `276-socketHandlers-extract-run-and-cleanup`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Normalize Extracted Handler Indentation
Several extracted socket handler callbacks in `game/server/socketHandlers/runHandlers.js` and nearby handler modules retain the old inline indentation level. Behavior is unaffected, but normalizing indentation would make future socket-handler reviews easier.

### Acceptance Criteria
- `game/server/socketHandlers/runHandlers.js` and adjacent touched handler modules use consistent indentation inside each `withLobby...` callback.

## Retire Stale Shop Buy Affordance
The server-side `buyShopCard` socket handler is intentionally removed and no client emitter remains, but the lobby shop still renders a `Buy` button element. If card buying is no longer a supported lobby action, removing or repurposing that inert button would avoid confusing future UI work.

### Acceptance Criteria
- The card shop UI no longer presents an enabled buy affordance unless there is a live supported purchase flow behind it.
