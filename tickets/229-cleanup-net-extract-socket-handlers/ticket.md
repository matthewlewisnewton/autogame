# Cleanup nits from 210-net-extract-socket-handlers

> **Staleness note.** This follow-up ticket was written against commit
> `e27af0a` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `210-net-extract-socket-handlers`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Normalize Extracted Handler Indentation

Several extracted socket handler callbacks preserve the old inline indentation, so nested callback bodies in `game/server/socketHandlers/deck.js`, `trade.js`, and `run.js` are harder to scan than the surrounding code. This is non-blocking because behavior and tests are correct, but a formatting pass would make future handler edits less error-prone.

### Acceptance Criteria
- Callback bodies in the extracted socket handler modules are consistently indented with the surrounding server style, with no behavior changes.
