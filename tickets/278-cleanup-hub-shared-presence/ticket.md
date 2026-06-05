# Cleanup nits from 232-hub-shared-presence

> **Staleness note.** This follow-up ticket was written against commit
> `10aa9473` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `232-hub-shared-presence`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Document Hub Presence Socket Event

`game/docs/lobbies.md` documents the lobby socket events but does not list the new `hubPresenceUpdate` server-to-client event. Adding it would keep the architecture docs aligned with the live API and make future client/server work easier to discover.

### Acceptance Criteria
- `game/docs/lobbies.md` lists `hubPresenceUpdate` in the server-to-client events table with its lobby-phase timing and `{ lobbyId, revision, players }` payload shape.
