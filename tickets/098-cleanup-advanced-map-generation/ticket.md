# Cleanup nits from 023-advanced-map-generation

> **Staleness note.** This follow-up ticket was written against commit
> `9b0a9ad` (2026-05-22). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `023-advanced-map-generation`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Use Role-Based Client Spawn Lookup
`game/client/dungeon.js` still describes and returns the client spawn position as the first room, while the server contract now says player spawn uses the room marked `start`. This is harmless today because role assignment always marks room index 0 as `start`, but using the role directly would keep the client helper aligned if start-room selection changes later.
### Acceptance Criteria
- `buildDungeon()` derives `spawnPosition` from the room with `role === 'start'`, with a fallback to the first room.
- Nearby comments refer to the start room role rather than the first room.
