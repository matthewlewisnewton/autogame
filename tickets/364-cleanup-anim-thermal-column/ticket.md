# Cleanup nits from 363-anim-thermal-column

> **Staleness note.** This follow-up ticket was written against commit
> `e6add21a` (2026-06-08). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `363-anim-thermal-column`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Emit Thermal Column DoT Interval In The Card Event

The Thermal Column renderer currently falls back to the known 500 ms DoT interval, which matches the current shared card stats. Emitting `dotIntervalMs` alongside `dotTicks` in the server `CARD_USED` payload would remove the duplicated timing assumption and keep future balance changes automatically synced.

### Acceptance Criteria
- `inferno_pillar` `CARD_USED` events include `dotIntervalMs` from the server card definition.
- The client renderer test covers a non-default `dotIntervalMs` value and verifies scheduled pulse timing follows the event payload.
