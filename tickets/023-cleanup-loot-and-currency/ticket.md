# Cleanup nits from 016-loot-and-currency

> **Staleness note.** This follow-up ticket was written against commit
> `7bb5c34` (2026-05-18). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `016-loot-and-currency`.
None blocked acceptance — clean them up when convenient.

## Throttle per-frame loot pickup emission

While a player stands on a loot item, the client emits `lootPickup` every
animation frame (~60/s) until the next 1 Hz `stateUpdate` removes the item.
The server is idempotent so this is harmless, but it is wasteful network
traffic. Emitting once per loot id and clearing the throttle when the item
disappears would be cleaner.

### Acceptance Criteria
- A player standing on a loot item emits at most one `lootPickup` per loot id
  (not one per frame).
- Pickup still works reliably the moment a player walks over loot.

## Exclude dead players from collecting loot

Neither the client proximity check (`game/client/main.js:920`) nor the server
`lootPickup` handler (`game/server/index.js:773`) excludes dead players. A
downed player overlapping a loot item can still collect currency, which is
inconsistent with dead players being barred from combat actions.

### Acceptance Criteria
- A dead player (`player.dead === true`) does not collect loot.
- The server `lootPickup` handler ignores requests from dead players.
