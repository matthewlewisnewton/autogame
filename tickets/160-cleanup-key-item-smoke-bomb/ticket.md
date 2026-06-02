# Cleanup nits from 128-key-item-smoke-bomb

> **Staleness note.** This follow-up ticket was written against commit
> `bd606fa` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `128-key-item-smoke-bomb`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Align smoke VFX radius with server zone radius

Client `SMOKE_BOMB_RADIUS` is `3` in `renderer.js` while the server def uses `radius: 4`, so the fog mesh reads smaller than the actual suppression disk.

### Acceptance Criteria

- `triggerSmokeBombVFX` uses the same radius constant as `KEY_ITEM_DEFS.smoke_bomb.radius` (or a shared documented value of `4`).
- Visual extent roughly matches `isInSmokeZone` gameplay radius in a manual cast.

## Update smoke_bomb key-item description text

`progression.js` still describes smoke bomb as "Become temporarily invisible"; behavior is a fixed ground fog zone that suppresses enemy targeting, not per-player invisibility.

### Acceptance Criteria

- `smoke_bomb.description` mentions a short-lived smoke zone and enemy detection loss (or similar accurate wording).
- No change to cooldown, duration, or radius numbers unless intentionally retuned.
