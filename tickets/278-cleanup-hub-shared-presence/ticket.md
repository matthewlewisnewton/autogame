# Cleanup nits from 232-hub-shared-presence

> **Staleness note.** This follow-up ticket was written against commit
> `9af0f653` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `232-hub-shared-presence`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Document Hub Presence In Lobby Object Shape
`game/docs/lobbies.md` documents the lobby object shape but still lists only `id`, `name`, `state`, and `createdAt`. Since this ticket adds `hubPresence` as owned lobby state, the schema snippet should include it for future maintainers.
### Acceptance Criteria
- `game/docs/lobbies.md` includes `hubPresence` in the documented lobby object shape.
